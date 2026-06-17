// Cross-cutting read helpers shared by the sheet and skill views — Revision 2.

import type { Character, Preset, Ruleset, SkillAction, SkillNode, SkillTree } from './types';
import { ownedNodes } from './engine/tree';

export type PresetSection = 'stats' | 'standard' | 'actionTabs' | 'skillTabs';

/** Whether a preset supplies content for a given section (drives "Apply preset" menus). */
export function presetProvides(p: Preset, section: PresetSection): boolean {
  switch (section) {
    case 'stats': return !!p.statTiers;
    case 'standard': return !!p.standardActionIds;
    case 'actionTabs': return !!p.actionTabs?.length;
    case 'skillTabs': return !!(p.skillTabs?.length || p.pinnedTreeIds?.length);
  }
}

export interface OwnedAction {
  action: SkillAction;
  source: 'skill' | 'item' | 'standard';
  sourceName: string;
  sourceCategory?: string; // tree category or item category
  treeId?: string; // present for skill-granted actions (enables Node view)
}

/** Every action granted by owned skill nodes and equipped items (§6.1, §2 rev4). */
export function ownedActions(character: Character, ruleset: Ruleset): OwnedAction[] {
  const out: OwnedAction[] = [];
  for (const tree of ruleset.trees) {
    const progress = character.trees[tree.id];
    if (!progress) continue;
    for (const node of ownedNodes(tree, progress)) {
      for (const action of node.actions) out.push({ action, source: 'skill', sourceName: tree.name, sourceCategory: tree.category, treeId: tree.id });
    }
  }
  const itemsById = new Map(ruleset.items.map((i) => [i.id, i]));
  for (const entry of character.inventory) {
    if (!entry.equipped) continue;
    const item = itemsById.get(entry.itemId);
    if (!item) continue;
    for (const action of item.actions) out.push({ action, source: 'item', sourceName: item.name, sourceCategory: item.category });
  }
  // Global standard actions — owned by every character (hide-filtering happens in the view).
  for (const action of ruleset.standardActions ?? []) {
    out.push({ action, source: 'standard', sourceName: 'Standard', sourceCategory: 'Standard' });
  }
  return out;
}

/** Trees a player can see: only those marked done (GM sees all). */
export function visibleTrees(ruleset: Ruleset, gm: boolean): SkillTree[] {
  return gm ? ruleset.trees : ruleset.trees.filter((t) => t.status === 'done');
}

/** Trees in which the character owns at least one node. */
export function ownedTrees(character: Character, ruleset: Ruleset): SkillTree[] {
  return ruleset.trees.filter((t) => {
    const p = character.trees[t.id];
    return p && ownedNodes(t, p).length > 0;
  });
}

export type TreeStatus = 'owned' | 'available';

export function treeStatus(character: Character | null, tree: SkillTree): TreeStatus {
  if (!character) return 'available';
  const p = character.trees[tree.id];
  if (p && ownedNodes(tree, p).length > 0) return 'owned';
  return 'available';
}

export function allTreeTags(trees: SkillTree[]): string[] {
  const set = new Set<string>();
  for (const t of trees) for (const tag of t.tags) set.add(tag);
  return [...set].sort();
}

/** Match a tree against free text (name + tags + description, §1). */
export function matchesQuery(tree: SkillTree, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (tree.name.toLowerCase().includes(q)) return true;
  if (tree.description.toLowerCase().includes(q)) return true;
  return tree.tags.some((t) => t.toLowerCase().includes(q));
}

/** All tags actually used by actions (rule + finding) for tab building. */
export function actionTags(owned: OwnedAction[], includeFinding: boolean): string[] {
  const set = new Set<string>();
  for (const o of owned) {
    for (const t of o.action.ruleTags) set.add(t);
    if (includeFinding) for (const t of o.action.findingTags) set.add(t);
  }
  return [...set].sort();
}
