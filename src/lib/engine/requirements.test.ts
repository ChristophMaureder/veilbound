import { describe, it, expect } from 'vitest';
import type { Character, Ruleset, SkillNode, SkillTree, TreeRequirement } from '../types';
import type { Derived } from './derive';
import { treeLevel, evalRequirement, treeLocked } from './requirements';

function node(id: string, cost: number, prereqs: string[] = []): SkillNode {
  return { id, name: id, cost, description: '', prerequisite: '', prereqNodeIds: prereqs, exclusive: false, actions: [], grants: [], hideName: false, hideDescription: false, hidePrerequisite: false };
}
function tree(id: string, nodes: SkillNode[], subcategory?: string): SkillTree {
  return { id, name: id, description: '', tags: [], category: 'C', subcategory, status: 'done', nodes };
}
const rs = (trees: SkillTree[]): Ruleset => ({ trees } as unknown as Ruleset);
const ch = (trees: Character['trees']): Character => ({ trees } as unknown as Character);
const der = (stats: Record<string, { effective: number }>): Derived => ({ stats } as unknown as Derived);

describe('treeLevel = owned-node count', () => {
  const t = tree('t', [node('a', 2), node('b', 2, ['a'])]);
  it('counts only fully-owned nodes', () => {
    expect(treeLevel(ch({ t: { prereqMet: {}, invested: { a: 2 } } }), rs([t]), 't')).toBe(1);
    expect(treeLevel(ch({ t: { prereqMet: {}, invested: { a: 2, b: 2 } } }), rs([t]), 't')).toBe(2);
    expect(treeLevel(ch({ t: { prereqMet: {}, invested: { a: 1 } } }), rs([t]), 't')).toBe(0);
  });
  it('is 0 with no progress', () => {
    expect(treeLevel(ch({}), rs([t]), 't')).toBe(0);
  });
});

describe('evalRequirement', () => {
  const fire = tree('fire', [node('a', 1), node('b', 1, ['a'])]);
  const r = rs([fire]);

  it('treeLevel met/unmet', () => {
    const req: TreeRequirement = { id: 'r', kind: 'treeLevel', treeId: 'fire', min: 2 };
    expect(evalRequirement(req, ch({ fire: { prereqMet: {}, invested: { a: 1 } } }), r, der({})).met).toBe(false);
    expect(evalRequirement(req, ch({ fire: { prereqMet: {}, invested: { a: 1, b: 1 } } }), r, der({})).met).toBe(true);
  });

  it('subcatLevel counts trees in a subcategory at a level', () => {
    const f1 = tree('f1', [node('a', 1)], 'Fire');
    const f2 = tree('f2', [node('a', 1)], 'Fire');
    const ruleset = rs([f1, f2]);
    const req: TreeRequirement = { id: 'r', kind: 'subcatLevel', subcategory: 'Fire', level: 1, count: 2 };
    const c = ch({ f1: { prereqMet: {}, invested: { a: 1 } }, f2: { prereqMet: {}, invested: { a: 1 } } });
    expect(evalRequirement(req, c, ruleset, der({})).met).toBe(true);
    const cOne = ch({ f1: { prereqMet: {}, invested: { a: 1 } } });
    expect(evalRequirement(req, cOne, ruleset, der({})).met).toBe(false);
  });

  it('stat reads effective derived value', () => {
    const req: TreeRequirement = { id: 'r', kind: 'stat', stat: 'STR', min: 12 };
    expect(evalRequirement(req, ch({}), r, der({ STR: { effective: 12 } })).met).toBe(true);
    expect(evalRequirement(req, ch({}), r, der({ STR: { effective: 8 } })).met).toBe(false);
  });
});

describe('treeLocked', () => {
  const gated: SkillTree = { ...tree('g', [node('a', 1)]), requirements: [{ id: 'r', kind: 'stat', stat: 'STR', min: 10 }] };
  it('locks when unmet, unlocks when met', () => {
    expect(treeLocked(gated, ch({}), rs([gated]), der({ STR: { effective: 8 } }))).toBe(true);
    expect(treeLocked(gated, ch({}), rs([gated]), der({ STR: { effective: 10 } }))).toBe(false);
  });
  it('respects the player override', () => {
    const c = ch({ g: { prereqMet: {}, invested: {}, unlocked: true } });
    expect(treeLocked(gated, c, rs([gated]), der({ STR: { effective: 8 } }))).toBe(false);
  });
  it('no requirements = never locked', () => {
    expect(treeLocked(tree('x', [node('a', 1)]), ch({}), rs([]), der({}))).toBe(false);
  });
});
