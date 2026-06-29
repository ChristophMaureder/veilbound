// ──────────────────────────────────────────────────────────────────────────
// Skill-tree graph model — Revision 3 (free-form, auto-laid-out).
//
// A tree is a directed graph of nodes connected by `prereqNodeIds`. A node with
// several prerequisites is a MERGE: any one owned prerequisite unlocks it (§7).
// Branches can be marked exclusive per source node (§8). Positions are computed
// automatically (layered layout) — nodes store no coordinates.
// ──────────────────────────────────────────────────────────────────────────

import type { SkillNode, SkillTree, TreeProgress } from '../types';

export interface NodeView {
  node: SkillNode;
  invested: number;
  cost: number;
  owned: boolean;
  available: boolean;
  locked: boolean; // blocked by an exclusive sibling branch
  partial: boolean;
  fill: number;
  missing: number;
  children: string[];
}

export function childMap(tree: SkillTree): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of tree.nodes) map.set(n.id, []);
  for (const n of tree.nodes) for (const p of n.prereqNodeIds) if (map.has(p)) map.get(p)!.push(n.id);
  return map;
}

export function rootNodes(tree: SkillTree): SkillNode[] {
  return tree.nodes.filter((n) => n.prereqNodeIds.length === 0);
}

/** All nodes reachable downstream of `startId` (inclusive). */
function descendants(start: string, children: Map<string, string[]>): Set<string> {
  const set = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return set;
}

/**
 * Max nodes a player can ever own in this tree, accounting for exclusive branches.
 * For each exclusive split: if committed, lock the unchosen branches (same as normal);
 * if not yet committed, lock all but the largest branch so the total isn't inflated.
 */
export function maxReachableCount(tree: SkillTree, progress: TreeProgress): number {
  const children = childMap(tree);
  const invested = progress.invested;
  const locked = new Set<string>();

  for (const n of tree.nodes) {
    const kids = children.get(n.id) ?? [];
    if (!n.exclusive || kids.length < 2) continue;

    const committed = kids.filter((k) => {
      const sub = descendants(k, children);
      return [...sub].some((id) => (invested[id] ?? 0) > 0);
    });

    if (committed.length >= 1) {
      for (const k of kids) {
        if (!committed.includes(k)) for (const id of descendants(k, children)) locked.add(id);
      }
    } else {
      // No commitment yet — only count the largest branch, lock the rest
      const sized = kids.map((k) => ({ k, size: descendants(k, children).size }));
      sized.sort((a, b) => b.size - a.size);
      for (const { k } of sized.slice(1)) {
        for (const id of descendants(k, children)) locked.add(id);
      }
    }
  }

  return tree.nodes.filter((n) => !locked.has(n.id)).length;
}

export function computeTreeView(tree: SkillTree, progress: TreeProgress): NodeView[] {
  const children = childMap(tree);
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const invested = progress.invested;

  // Lock branches under exclusive nodes the player has already committed to.
  const locked = new Set<string>();
  for (const n of tree.nodes) {
    const kids = children.get(n.id) ?? [];
    if (!n.exclusive || kids.length < 2) continue;
    const committed = kids.filter((k) => {
      const sub = descendants(k, children);
      return [...sub].some((id) => (invested[id] ?? 0) > 0);
    });
    if (committed.length >= 1) {
      for (const k of kids) {
        if (!committed.includes(k)) for (const id of descendants(k, children)) locked.add(id);
      }
    }
  }

  const ownedSet = new Set<string>();
  const availableSet = new Set<string>();
  let changed = true;
  let guard = 0;
  while (changed && guard++ < tree.nodes.length + 2) {
    changed = false;
    for (const n of tree.nodes) {
      if (locked.has(n.id)) continue;
      // MERGE semantics: any one owned prerequisite suffices (§7).
      const avail = n.prereqNodeIds.length === 0 || n.prereqNodeIds.some((p) => ownedSet.has(p));
      if (avail && !availableSet.has(n.id)) {
        availableSet.add(n.id);
        changed = true;
      }
      const owned = avail && (invested[n.id] ?? 0) >= n.cost;
      if (owned && !ownedSet.has(n.id)) {
        ownedSet.add(n.id);
        changed = true;
      }
    }
  }

  return tree.nodes.map((n) => {
    const inv = invested[n.id] ?? 0;
    const owned = ownedSet.has(n.id);
    const available = availableSet.has(n.id);
    const partial = inv > 0 && inv < n.cost;
    return {
      node: n,
      invested: inv,
      cost: n.cost,
      owned,
      available,
      locked: locked.has(n.id),
      partial,
      fill: n.cost > 0 ? Math.min(1, inv / n.cost) : owned ? 1 : 0,
      missing: partial ? n.cost - inv : 0,
      children: children.get(n.id) ?? [],
    };
  });
  void byId;
}

// ── Auto-layout (layered) ────────────────────────────────────────────────────
export interface LayoutPos {
  x: number; // centred column (can be fractional/negative)
  depth: number; // 0 = root layer
}
export interface TreeLayout {
  pos: Map<string, LayoutPos>;
  maxDepth: number;
}

export function computeLayout(tree: SkillTree): TreeLayout {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(id: string): number {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const n = byId.get(id);
    let d = 0;
    if (n && n.prereqNodeIds.length) {
      d = Math.max(...n.prereqNodeIds.filter((p) => byId.has(p)).map((p) => depthOf(p) + 1), 0);
    }
    visiting.delete(id);
    depthMemo.set(id, d);
    return d;
  }

  let maxDepth = 0;
  for (const n of tree.nodes) maxDepth = Math.max(maxDepth, depthOf(n.id));

  // Build a layout tree: each non-root gets exactly one "layout parent" (its first existing prereq).
  // This avoids double-counting MERGE nodes. Edges to additional parents are still drawn.
  const layoutKids = new Map<string, string[]>(tree.nodes.map((n) => [n.id, []]));
  const hasLayoutParent = new Set<string>();
  const depthOrder = [...tree.nodes].sort((a, b) => depthOf(a.id) - depthOf(b.id));
  for (const n of depthOrder) {
    if (n.prereqNodeIds.length === 0 || hasLayoutParent.has(n.id)) continue;
    const primary = n.prereqNodeIds.find((p) => byId.has(p));
    if (primary) {
      layoutKids.get(primary)!.push(n.id);
      hasLayoutParent.add(n.id);
    }
  }

  // Count leaf-slots in each node's layout subtree (1 for leaves).
  const slots = new Map<string, number>();
  const slotVisited = new Set<string>();
  function countSlots(id: string): number {
    if (slotVisited.has(id)) return 1;
    slotVisited.add(id);
    const kids = layoutKids.get(id) ?? [];
    const s = kids.length === 0 ? 1 : Math.max(1, kids.reduce((sum, k) => sum + countSlots(k), 0));
    slots.set(id, s);
    return s;
  }
  const roots = tree.nodes.filter((n) => depthOf(n.id) === 0).map((n) => n.id);
  for (const r of roots) countSlots(r);

  // Assign x = centre of allocated slot range; recurse children left-to-right.
  const pos = new Map<string, LayoutPos>();
  function assignX(id: string, left: number): void {
    if (pos.has(id)) return;
    const s = slots.get(id) ?? 1;
    pos.set(id, { x: left + (s - 1) / 2, depth: depthOf(id) });
    let cursor = left;
    for (const kid of layoutKids.get(id) ?? []) {
      assignX(kid, cursor);
      cursor += slots.get(kid) ?? 1;
    }
  }
  let totalLeft = 0;
  for (const r of roots) {
    assignX(r, totalLeft);
    totalLeft += slots.get(r) ?? 1;
  }
  // Any nodes not reached (disconnected / cycle remnants).
  for (const n of tree.nodes) {
    if (!pos.has(n.id)) pos.set(n.id, { x: totalLeft++, depth: depthOf(n.id) });
  }

  // Centre MERGE nodes (multiple prereqs) between their parents' x positions.
  for (const n of tree.nodes) {
    if (n.prereqNodeIds.length < 2) continue;
    const parentXs = n.prereqNodeIds.map((p) => pos.get(p)?.x).filter((x): x is number => x !== undefined);
    if (parentXs.length >= 2) {
      const avg = parentXs.reduce((s, x) => s + x, 0) / parentXs.length;
      const curr = pos.get(n.id)!;
      pos.set(n.id, { ...curr, x: avg });
    }
  }

  // Re-centre around x = 0.
  const xs = [...pos.values()].map((p) => p.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const [id, p] of pos) pos.set(id, { ...p, x: p.x - mid });

  return { pos, maxDepth };
}

// ── Investing / unlearning ───────────────────────────────────────────────────
export function pourPoints(
  tree: SkillTree,
  progress: TreeProgress,
  startId: string,
  amount: number,
  remaining: number,
): { invested: Record<string, number>; spent: number } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const children = childMap(tree);
  const invested = { ...progress.invested };
  let budget = Math.max(0, Math.min(amount, remaining));
  let spent = 0;
  let cursor: string | null = startId;

  const isAvailable = (id: string): boolean => {
    const v = computeTreeView(tree, { ...progress, invested }).find((x) => x.node.id === id);
    return v ? v.available : false;
  };

  while (budget > 0 && cursor) {
    const node: SkillNode | undefined = byId.get(cursor);
    if (!node) break;
    if (!isAvailable(cursor)) break;
    const have = invested[cursor] ?? 0;
    const need = node.cost - have;
    if (need > 0) {
      const dep = Math.min(budget, need);
      invested[cursor] = have + dep;
      spent += dep;
      budget -= dep;
      if (invested[cursor] < node.cost) break;
    }
    const kids: string[] = children.get(cursor) ?? [];
    cursor = kids.length === 1 ? kids[0] : null;
  }
  return { invested, spent };
}

export function unlearnFrom(
  tree: SkillTree,
  progress: TreeProgress,
  startId: string,
): { invested: Record<string, number>; refunded: number } {
  const children = childMap(tree);
  const toClear = descendants(startId, children);
  const invested = { ...progress.invested };
  let refunded = 0;
  for (const id of toClear) {
    refunded += invested[id] ?? 0;
    delete invested[id];
  }
  return { invested, refunded };
}

export function totalInvestedInTree(progress: TreeProgress | undefined): number {
  if (!progress) return 0;
  return Object.values(progress.invested).reduce((s, n) => s + (n > 0 ? n : 0), 0);
}

export function ownedNodes(tree: SkillTree, progress: TreeProgress | undefined): SkillNode[] {
  if (!progress) return [];
  return computeTreeView(tree, progress).filter((v) => v.owned).map((v) => v.node);
}

export const emptyProgress = (): TreeProgress => ({ prereqMet: {}, invested: {} });

/**
 * Learn every node along the clear chain from the current frontier to `targetId`.
 * Walks backward from target; stops at owned nodes, root nodes, or MERGE nodes
 * (multiple prereqs = ambiguous which path to use). Stops at nodes with unanswered
 * narrative prerequisites. Points are invested forward in order until budget runs out.
 */
export function learnPathTo(
  tree: SkillTree,
  progress: TreeProgress,
  targetId: string,
  remaining: number,
): { invested: Record<string, number>; spent: number } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const view = computeTreeView(tree, progress);
  const ownedSet = new Set(view.filter((v) => v.owned).map((v) => v.node.id));

  // Walk backward from target to build the clear path.
  const pathNodes: string[] = [];
  let cursor: string | null = targetId;
  const visited = new Set<string>();

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    if (ownedSet.has(cursor)) break; // already owned — don't include
    const node = byId.get(cursor);
    if (!node) break;
    pathNodes.unshift(cursor);
    if (node.prereqNodeIds.length === 0) break; // root
    if (node.prereqNodeIds.length > 1) break;   // MERGE — ambiguous, stop before going further
    cursor = node.prereqNodeIds[0];
  }

  if (!pathNodes.length) return { invested: { ...progress.invested }, spent: 0 };

  // Invest forward along the path.
  let invested = { ...progress.invested };
  let budget = remaining;
  let spent = 0;

  for (const nodeId of pathNodes) {
    const node = byId.get(nodeId);
    if (!node) break;
    // Stop at unanswered narrative prerequisite.
    if (node.prerequisite.trim() && progress.prereqMet[nodeId] === undefined) break;
    const tempView = computeTreeView(tree, { ...progress, invested });
    const nv = tempView.find((v) => v.node.id === nodeId);
    if (!nv?.available || nv.locked) break;
    const have = invested[nodeId] ?? 0;
    const need = node.cost - have;
    if (need <= 0) continue;
    const dep = Math.min(budget, need);
    invested = { ...invested, [nodeId]: have + dep };
    spent += dep;
    budget -= dep;
    if (dep < need) break; // not enough points to finish this node
    if (budget <= 0) break;
  }

  return { invested, spent };
}
