import { describe, it, expect } from 'vitest';
import type { SkillNode, SkillTree, TreeProgress } from '../types';
import { computeTreeView, pourPoints, unlearnFrom, childMap } from './tree';

function node(id: string, cost: number, prereqs: string[] = [], exclusive = false): SkillNode {
  return {
    id,
    name: id,
    cost,
    description: '',
    prerequisite: '',
    prereqNodeIds: prereqs,
    exclusive,
    actions: [],
    grants: [],
    hideName: false,
    hideDescription: false,
    hidePrerequisite: false,
  };
}

function tree(nodes: SkillNode[]): SkillTree {
  return { id: 't', name: 'T', description: '', tags: [], category: '', status: 'done', nodes };
}

const prog = (invested: Record<string, number> = {}): TreeProgress => ({ prereqMet: {}, invested });

describe('childMap', () => {
  it('reverses prereq edges', () => {
    const t = tree([node('a', 1), node('b', 1, ['a']), node('c', 1, ['a'])]);
    const m = childMap(t);
    expect(m.get('a')!.sort()).toEqual(['b', 'c']);
    expect(m.get('b')).toEqual([]);
  });
});

describe('computeTreeView availability', () => {
  it('a node is unavailable until all prereqs are owned', () => {
    const t = tree([node('a', 2), node('b', 2, ['a'])]);
    let v = computeTreeView(t, prog());
    expect(v.find((x) => x.node.id === 'b')!.available).toBe(false);
    v = computeTreeView(t, prog({ a: 2 }));
    expect(v.find((x) => x.node.id === 'a')!.owned).toBe(true);
    expect(v.find((x) => x.node.id === 'b')!.available).toBe(true);
  });

  it('a merge node needs only ONE incoming path (§7)', () => {
    const t = tree([node('a', 1), node('b', 1), node('m', 1, ['a', 'b'])]);
    const v = computeTreeView(t, prog({ a: 1 }));
    expect(v.find((x) => x.node.id === 'm')!.available).toBe(true);
  });

  it('an exclusive branch locks the sibling once committed', () => {
    // root -> (left | right), root exclusive
    const t = tree([node('root', 1, [], true), node('left', 1, ['root']), node('right', 1, ['root'])]);
    const v = computeTreeView(t, prog({ root: 1, left: 1 }));
    expect(v.find((x) => x.node.id === 'right')!.locked).toBe(true);
    expect(v.find((x) => x.node.id === 'right')!.available).toBe(false);
  });

  it('reports partial fill + missing', () => {
    const t = tree([node('a', 5)]);
    const v = computeTreeView(t, prog({ a: 3 }))[0];
    expect(v.partial).toBe(true);
    expect(v.missing).toBe(2);
    expect(v.fill).toBeCloseTo(0.6);
  });
});

describe('pourPoints', () => {
  it('fills one node (just enough)', () => {
    const t = tree([node('a', 5), node('b', 5, ['a'])]);
    const r = pourPoints(t, prog(), 'a', 5, 10);
    expect(r.spent).toBe(5);
    expect(r.invested.a).toBe(5);
    expect(r.invested.b).toBeUndefined();
  });
  it('banks overflow into a single child', () => {
    const t = tree([node('a', 5), node('b', 5, ['a'])]);
    const r = pourPoints(t, prog(), 'a', 10, 10);
    expect(r.invested.a).toBe(5);
    expect(r.invested.b).toBe(5);
  });
  it('overflow stops at a branch (multiple children)', () => {
    const t = tree([node('a', 2), node('b', 2, ['a']), node('c', 2, ['a'])]);
    const r = pourPoints(t, prog(), 'a', 100, 100);
    expect(r.invested.a).toBe(2);
    expect(r.invested.b).toBeUndefined();
    expect(r.spent).toBe(2);
  });
  it('never spends more than remaining', () => {
    const t = tree([node('a', 5)]);
    expect(pourPoints(t, prog(), 'a', 100, 3).spent).toBe(3);
  });
});

describe('unlearnFrom', () => {
  it('cascades downstream and refunds', () => {
    const t = tree([node('a', 2), node('b', 2, ['a']), node('c', 2, ['b'])]);
    const r = unlearnFrom(t, prog({ a: 2, b: 2, c: 1 }), 'b');
    expect(r.refunded).toBe(3);
    expect(r.invested.a).toBe(2);
    expect(r.invested.b).toBeUndefined();
    expect(r.invested.c).toBeUndefined();
  });
});
