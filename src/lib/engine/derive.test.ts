import { describe, it, expect } from 'vitest';
import { deriveCharacter, baseFromTable } from './derive';
import { defaultRuleset, newCharacter } from '../defaults';
import type { Character, Ruleset } from '../types';

function fillTable(r: Ruleset) {
  // base at L1, +1 per level to pri/sec/tert/quat
  r.levelTable = r.levelTable.map((row) =>
    row.level === 1
      ? { ...row, pri: 12, sec: 10, tert: 9, quat: 8, soul: 2 }
      : { ...row, pri: 1, sec: 1, tert: 1, quat: 1, soul: null },
  );
}

function setup(): { ruleset: Ruleset; character: Character } {
  const ruleset = defaultRuleset();
  fillTable(ruleset);
  const character = newCharacter('Test', ruleset, { STR: 'pri', DEX: 'sec', KNO: 'tert', WIL: 'quat' });
  return { ruleset, character };
}

describe('baseFromTable', () => {
  it('level-1 is base, later rows are increments', () => {
    const r = defaultRuleset();
    fillTable(r);
    expect(baseFromTable(r.levelTable, 'pri', 1)).toBe(12);
    expect(baseFromTable(r.levelTable, 'pri', 3)).toBe(14);
  });
  it('empty table yields 0', () => {
    const r = defaultRuleset(); // ships empty
    expect(baseFromTable(r.levelTable, 'pri', 5)).toBe(0);
  });
});

describe('deriveCharacter', () => {
  it('maps tiers to stats', () => {
    const { ruleset, character } = setup();
    const d = deriveCharacter(character, ruleset);
    expect(d.stats.STR.base).toBe(12);
    expect(d.stats.WIL.base).toBe(8);
  });

  it('prof from formula floor(level/4)+2', () => {
    const { ruleset, character } = setup();
    character.level = 8;
    expect(deriveCharacter(character, ruleset).prof).toBe(4);
  });

  it('skill points come from grants', () => {
    const { ruleset, character } = setup();
    character.grantedSkillPoints = 10;
    expect(deriveCharacter(character, ruleset).skillRemaining).toBe(10);
  });

  it('mana resource becomes visible when granted', () => {
    const { ruleset, character } = setup();
    character.trees['tree_pyromancy'] = { prereqMet: {}, invested: { py1: 2 } };
    const mana = deriveCharacter(character, ruleset).resourceById['mana'];
    expect(mana.visible).toBe(true);
    expect(mana.max).toBe(6); // grant amount
  });

  it('item Add grants do not stack — highest wins (§10)', () => {
    const { ruleset, character } = setup();
    ruleset.items.push(
      { id: 'r1', name: 'Ring +1', description: '', level: 1, category: 'Accessory', tags: [], weight: 0, flavour: '', actions: [], weapon: null, grants: [{ id: 'g1', kind: 'modifier', target: 'STR', value: 1, mode: 'add' }] },
      { id: 'r2', name: 'Ring +2', description: '', level: 1, category: 'Accessory', tags: [], weight: 0, flavour: '', actions: [], weapon: null, grants: [{ id: 'g2', kind: 'modifier', target: 'STR', value: 2, mode: 'add' }] },
    );
    character.inventory = [
      { id: 'e1', itemId: 'r1', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null },
      { id: 'e2', itemId: 'r2', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null },
    ];
    expect(deriveCharacter(character, ruleset).stats.STR.effective).toBe(14); // 12 + best(2), not 12+3
  });

  it('Set takes priority over Add', () => {
    const { ruleset, character } = setup();
    ruleset.items.push(
      { id: 's1', name: 'Set18', description: '', level: 1, category: 'Accessory', tags: [], weight: 0, flavour: '', actions: [], weapon: null, grants: [{ id: 'g', kind: 'modifier', target: 'STR', value: 18, mode: 'set' }] },
      { id: 'a1', name: 'Add5', description: '', level: 1, category: 'Accessory', tags: [], weight: 0, flavour: '', actions: [], weapon: null, grants: [{ id: 'g2', kind: 'modifier', target: 'STR', value: 5, mode: 'add' }] },
    );
    character.inventory = [
      { id: 'e1', itemId: 's1', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null },
      { id: 'e2', itemId: 'a1', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null },
    ];
    expect(deriveCharacter(character, ruleset).stats.STR.effective).toBe(18);
  });

  it('equipping a weapon produces use-modes with to-hit and damage terms', () => {
    const { ruleset, character } = setup();
    character.inventory = [{ id: 'e1', itemId: 'item_longsword', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null }];
    const d = deriveCharacter(character, ruleset);
    expect(d.weapons.length).toBe(1);
    expect(d.weapons[0].modes.length).toBe(2); // Slash + Thrust
    const slash = d.weapons[0].modes[0];
    expect(slash.toHit).toBe(d.prof + d.stats.STR.effective); // prof + scale(STR)
    // STR scale (12) merges into the same-type base die → one slashing term.
    expect(slash.damage.map((t) => t.notation)).toEqual(['1d8+12']);
  });

  it('item scoped damage bonuses add coloured terms (tag + mode, additive)', () => {
    const { ruleset, character } = setup();
    character.inventory = [
      { id: 'e1', itemId: 'item_longsword', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: 'main' },
      { id: 'e2', itemId: 'item_ring_sword', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null },
    ];
    const d = deriveCharacter(character, ruleset);
    const w = d.weapons.find((x) => x.itemName === 'Longsword')!;
    const slash = w.modes.find((m) => m.name === 'Slash')!;
    const thrust = w.modes.find((m) => m.name === 'Thrust')!;
    // Same-type terms merge (§ commit 194b07c). STR=12, DEX=10 from fillTable.
    // Slash: 1d8 + STR(12) + ring tag bonus(+1) → all slashing → '1d8+13'.
    expect(slash.damage.map((t) => t.notation)).toEqual(['1d8+13']);
    // Thrust: 1d6 + DEX(10) + mode bonus(+2) piercing; ring tag bonus(+1) is slashing (separate term).
    expect(thrust.damage.map((t) => t.notation).sort()).toEqual(['1', '1d6+12']);
    expect(d.weaponBySlot.main?.itemName).toBe('Longsword');
  });

  it('weaponBySlot reflects player slot assignment', () => {
    const { ruleset, character } = setup();
    character.inventory = [
      { id: 'e1', itemId: 'item_longsword', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: 'main' },
      { id: 'e2', itemId: 'item_dagger', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: 'secondary' },
    ];
    const d = deriveCharacter(character, ruleset);
    expect(d.weaponBySlot.main?.itemName).toBe('Longsword');
    expect(d.weaponBySlot.secondary?.itemName).toBe('Dagger');
  });

  it('skill scaling grant overrides weapon to-hit stat for a matching tag', () => {
    const { ruleset, character } = setup();
    character.inventory = [{ id: 'e1', itemId: 'item_longsword', bagId: 'bag_worn', equipped: true, qty: 1, weaponSlot: null }];
    // own ls4 (grants scaling longsword -> DEX). Needs ls1..ls4 owned.
    character.trees['tree_longsword'] = { prereqMet: {}, invested: { ls1: 2, ls2: 2, ls3: 2, ls4: 2 } };
    const d = deriveCharacter(character, ruleset);
    const slash = d.weapons[0].modes[0];
    expect(slash.toHitStat).toBe('DEX');
    expect(slash.toHit).toBe(d.prof + d.stats.DEX.effective);
  });
});
