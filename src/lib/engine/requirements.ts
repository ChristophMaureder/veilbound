// ──────────────────────────────────────────────────────────────────────────
// Structured tree requirements (separate from a node's narrative prerequisite).
//
// A tree may declare hard requirements that gate investment until met. A tree's
// "level" is the count of fully-owned nodes in it. Unmet requirements lock the
// tree; the player may override the lock (TreeProgress.unlocked).
// ──────────────────────────────────────────────────────────────────────────

import type { Character, Ruleset, SkillTree, TreeRequirement } from '../types';
import type { Derived } from './derive';
import { ownedNodes } from './tree';

/** A tree's "level" = number of fully-owned nodes in it. */
export function treeLevel(character: Character, ruleset: Ruleset, treeId: string): number {
  const tree = ruleset.trees.find((t) => t.id === treeId);
  if (!tree) return 0;
  const p = character.trees[treeId];
  return p ? ownedNodes(tree, p).length : 0;
}

export interface RequirementCheck {
  req: TreeRequirement;
  met: boolean;
  label: string;    // e.g. "5 levels in Pyromancy"
  progress: string; // e.g. "3 / 5"
}

export function evalRequirement(
  req: TreeRequirement,
  character: Character,
  ruleset: Ruleset,
  derived: Derived,
): RequirementCheck {
  if (req.kind === 'treeLevel') {
    const tree = ruleset.trees.find((t) => t.id === req.treeId);
    const have = treeLevel(character, ruleset, req.treeId);
    return {
      req,
      met: have >= req.min,
      label: `${req.min} level${req.min === 1 ? '' : 's'} in ${tree?.name ?? 'unknown tree'}`,
      progress: `${have} / ${req.min}`,
    };
  }
  if (req.kind === 'subcatLevel') {
    const have = ruleset.trees.filter(
      (t) => (t.subcategory ?? '') === req.subcategory && treeLevel(character, ruleset, t.id) >= req.level,
    ).length;
    return {
      req,
      met: have >= req.count,
      label: `${req.count} ${req.subcategory || '—'} tree${req.count === 1 ? '' : 's'} at level ${req.level}+`,
      progress: `${have} / ${req.count}`,
    };
  }
  // stat
  const have = derived.stats[req.stat]?.effective ?? 0;
  return { req, met: have >= req.min, label: `${req.min} ${req.stat}`, progress: `${have} / ${req.min}` };
}

export function evalRequirements(
  tree: SkillTree,
  character: Character,
  ruleset: Ruleset,
  derived: Derived,
): RequirementCheck[] {
  return (tree.requirements ?? []).map((r) => evalRequirement(r, character, ruleset, derived));
}

/** True when the tree has unmet requirements and the player hasn't overridden the gate. */
export function treeLocked(
  tree: SkillTree,
  character: Character | null,
  ruleset: Ruleset,
  derived: Derived | null,
): boolean {
  const reqs = tree.requirements ?? [];
  if (!reqs.length || !character || !derived) return false;
  if (character.trees[tree.id]?.unlocked) return false;
  return evalRequirements(tree, character, ruleset, derived).some((c) => !c.met);
}
