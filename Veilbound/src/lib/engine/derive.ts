// ──────────────────────────────────────────────────────────────────────────
// Character derivation — Revision 3.
//
// Adds: item grant modes (Set/Add/Multiply) with non-stacking per stat (Set
// priority); weapons with use-modes, dice damage split by type, and to-hit with
// configurable + skill-tag-scoped scaling.
// ──────────────────────────────────────────────────────────────────────────

import type {
  Character,
  CoreStat,
  GrantMode,
  ItemDef,
  LevelRow,
  ModifierTarget,
  Ruleset,
  Tier,
  WeaponMode,
  WeaponSlot,
} from '../types';
import { CORE_STATS } from '../types';
import { evalInt, type FormulaContext } from './formula';
import { ownedNodes, totalInvestedInTree } from './tree';

export interface Contribution {
  id: string;
  name: string;
  value: number;
  source: 'manual' | 'skill' | 'item';
  mode?: GrantMode;
}

export interface DerivedValue {
  base: number;
  contributions: Contribution[];
  effective: number;
}

export interface DerivedAC {
  low: number;
  high: number;
  baseLow: number;
  baseHigh: number;
  contributions: Contribution[];
  armourName: string | null;
}

export interface DerivedDamageTerm {
  notation: string;
  typeName: string;
  colour: string;
  isScale: boolean;
}

export interface DerivedWeaponMode {
  name: string;
  toHit: number;
  toHitStat: string;
  damage: DerivedDamageTerm[];
}

export interface DerivedWeapon {
  entryId: string;
  itemName: string;
  slot: string;
  modes: DerivedWeaponMode[];
}

export interface DerivedResource {
  def: import('../types').ResourceDef;
  max: number;
  baseMax: number;
  contributions: Contribution[];
  visible: boolean;
  granted: boolean;
}

export interface Derived {
  level: number;
  prof: number;
  stats: Record<CoreStat, DerivedValue>;
  hpMax: DerivedValue;
  soulMax: DerivedValue;
  ac: DerivedAC | null;
  damageBonus: DerivedValue;
  resources: DerivedResource[];
  resourceById: Record<string, DerivedResource>;
  weapons: DerivedWeapon[];
  weaponBySlot: { main: DerivedWeapon | null; secondary: DerivedWeapon | null };
  skillTotal: number;
  skillInvested: number;
  skillRemaining: number;
  overBudget: boolean;
  load: { total: number; perBag: Record<string, number> };
  ctx: FormulaContext;
}

export function baseFromTable(table: LevelRow[], col: Tier | 'soul', level: number): number {
  if (table.length === 0) return 0;
  const clamped = Math.max(1, Math.min(level, table.length));
  const row1 = table.find((r) => r.level === 1) ?? table[0];
  let total = row1[col] ?? 0;
  for (let l = 2; l <= clamped; l++) {
    const row = table.find((r) => r.level === l);
    if (row) total += row[col] ?? 0;
  }
  return total;
}

interface ItemMod {
  id: string;
  name: string;
  value: number;
  mode: GrantMode;
}

/**
 * Combine a base value with stacking contributions (manual + skill) and
 * non-stacking item contributions (Set priority, else highest result, §10).
 */
function resolveValue(base: number, stack: Contribution[], items: ItemMod[]): DerivedValue {
  const additive = stack.reduce((s, c) => s + c.value, 0);
  const pre = base + additive;
  const contributions = [...stack];
  let effective = pre;

  if (items.length) {
    const sets = items.filter((i) => i.mode === 'set');
    if (sets.length) {
      const win = sets.reduce((a, b) => (b.value > a.value ? b : a));
      effective = win.value;
      return {
        base,
        contributions: [{ id: win.id, name: win.name, value: win.value, source: 'item', mode: 'set' }],
        effective,
      };
    }
    let best = pre;
    let winner: ItemMod | null = null;
    for (const i of items) {
      const r = i.mode === 'mul' ? pre * i.value : pre + i.value;
      if (r > best) {
        best = r;
        winner = i;
      }
    }
    effective = best;
    if (winner) contributions.push({ id: winner.id, name: winner.name, value: winner.value, source: 'item', mode: winner.mode });
  }
  return { base, contributions, effective: Math.round(effective) };
}

export function deriveCharacter(character: Character, ruleset: Ruleset): Derived {
  const prof = evalInt(ruleset.formulas.prof, { level: character.level });

  // Collect contributions by target.
  const stackByTarget = new Map<ModifierTarget, Contribution[]>();
  const itemByTarget = new Map<ModifierTarget, ItemMod[]>();
  const resourceGrantAmt = new Map<string, number>();
  const grantedResourceIds = new Set<string>();
  const scalingGrants: { tag: string; attackTag: string; toHit: CoreStat | ''; damage: CoreStat | '' }[] = [];
  const addmodeGrants: { weaponTag: string; mode: WeaponMode }[] = [];
  const dmgBonuses: { scope: 'tag' | 'name' | 'mode'; scopeValue: string; formula: string; damageTypeId: string }[] = [];
  const acSources: { low: string; high: string; name: string }[] = [];

  const addStack = (t: ModifierTarget, c: Contribution) => {
    const l = stackByTarget.get(t) ?? [];
    l.push(c);
    stackByTarget.set(t, l);
  };
  const addItem = (t: ModifierTarget, m: ItemMod) => {
    const l = itemByTarget.get(t) ?? [];
    l.push(m);
    itemByTarget.set(t, l);
  };

  for (const m of character.modifiers) addStack(m.target, { id: m.id, name: m.name, value: m.value, source: 'manual' });

  // Owned skill node grants (stack).
  for (const tree of ruleset.trees) {
    const progress = character.trees[tree.id];
    if (!progress) continue;
    for (const node of ownedNodes(tree, progress)) {
      for (const g of node.grants) {
        if (g.kind === 'modifier') addStack(g.target, { id: g.id, name: tree.name, value: g.value, source: 'skill' });
        else if (g.kind === 'resource') {
          grantedResourceIds.add(g.resourceId);
          resourceGrantAmt.set(g.resourceId, (resourceGrantAmt.get(g.resourceId) ?? 0) + g.amount);
        } else if (g.kind === 'ac') acSources.push({ low: g.low, high: g.high, name: tree.name });
        else if (g.kind === 'scaling') scalingGrants.push({ tag: g.tag, attackTag: g.attackTag ?? '', toHit: g.toHit, damage: g.damage });
        else if (g.kind === 'dmgbonus') dmgBonuses.push({ scope: g.scope, scopeValue: g.scopeValue, formula: g.formula, damageTypeId: g.damageTypeId });
        else if (g.kind === 'addmode') addmodeGrants.push({ weaponTag: g.weaponTag, mode: g.mode });
      }
    }
  }

  // Equipped items.
  const itemsById = new Map(ruleset.items.map((i) => [i.id, i]));
  const equipped: { item: ItemDef; slot: WeaponSlot | null; entryId: string }[] = [];
  for (const entry of character.inventory) {
    if (!entry.equipped) continue;
    const item = itemsById.get(entry.itemId);
    if (!item) continue;
    equipped.push({ item, slot: entry.weaponSlot, entryId: entry.id });
    for (const g of item.grants) {
      if (g.kind === 'modifier') addItem(g.target, { id: g.id, name: item.name, value: g.value, mode: g.mode });
      else if (g.kind === 'resource') {
        grantedResourceIds.add(g.resourceId);
        resourceGrantAmt.set(g.resourceId, (resourceGrantAmt.get(g.resourceId) ?? 0) + g.amount);
      } else if (g.kind === 'ac') acSources.push({ low: g.low, high: g.high, name: item.name });
      else if (g.kind === 'scaling') scalingGrants.push({ tag: g.tag, attackTag: g.attackTag ?? '', toHit: g.toHit, damage: g.damage });
      else if (g.kind === 'dmgbonus') dmgBonuses.push({ scope: g.scope, scopeValue: g.scopeValue, formula: g.formula, damageTypeId: g.damageTypeId });
      else if (g.kind === 'addmode') addmodeGrants.push({ weaponTag: g.weaponTag, mode: g.mode });
    }
  }

  const stackOf = (t: ModifierTarget) => stackByTarget.get(t) ?? [];
  const itemsOf = (t: ModifierTarget) => itemByTarget.get(t) ?? [];

  // Tier-based stats.
  const stats = {} as Record<CoreStat, DerivedValue>;
  for (const s of CORE_STATS) {
    const tier = character.statTiers[s] ?? 'tert';
    const base = baseFromTable(ruleset.levelTable, tier, character.level);
    stats[s] = resolveValue(base, stackOf(s), itemsOf(s));
  }

  const damageBonus = resolveValue(0, stackOf('damage'), itemsOf('damage'));
  const soulBase = baseFromTable(ruleset.levelTable, 'soul', character.level);
  const ctx: FormulaContext = {
    level: character.level,
    STR: stats.STR.effective,
    DEX: stats.DEX.effective,
    KNO: stats.KNO.effective,
    WIL: stats.WIL.effective,
    prof,
    crit: character.crit,
    soul: soulBase,
    damage: damageBonus.effective,
  };

  const hpMax = resolveValue(evalInt(ruleset.formulas.hpMax, ctx), stackOf('hpMax'), itemsOf('hpMax'));
  const soulMax = resolveValue(evalInt(ruleset.formulas.soulMax, ctx), stackOf('soulMax'), itemsOf('soulMax'));

  // AC range from the best 'ac' grant + ac modifiers.
  let ac: DerivedAC | null = null;
  if (acSources.length) {
    let best: { low: number; high: number; name: string } | null = null;
    for (const s of acSources) {
      const low = evalInt(s.low, ctx);
      const high = evalInt(s.high, ctx);
      if (!best || high > best.high) best = { low, high, name: s.name };
    }
    if (best) {
      const adj = resolveValue(0, stackOf('ac'), itemsOf('ac'));
      ac = {
        baseLow: best.low,
        baseHigh: best.high,
        low: best.low + adj.effective,
        high: best.high + adj.effective,
        contributions: adj.contributions,
        armourName: best.name,
      };
    }
  }

  // Weapons.
  const statVal = (s: CoreStat | ''): number => (s ? stats[s].effective : 0);
  const dtById = new Map(ruleset.damageTypes.map((d) => [d.id, d]));

  const deriveMode = (item: ItemDef, mode: WeaponMode): DerivedWeaponMode => {
    let toHitStat: CoreStat | '' = mode.scaleToHit || 'STR';
    let dmgStat: CoreStat | '' = mode.scaleDamage;
    for (const sc of scalingGrants) {
      const matchWeapon = !sc.tag || item.tags.includes(sc.tag);
      const matchAttack = !sc.attackTag || (mode.attackType || '').toLowerCase() === sc.attackTag.toLowerCase();
      if (matchWeapon && matchAttack) {
        if (sc.toHit) toHitStat = sc.toHit;
        if (sc.damage) dmgStat = sc.damage;
      }
    }
    const toHit = evalInt(ruleset.toHitFormula, { ...ctx, scale: statVal(toHitStat) }) + mode.toHitBonus;
    const damage: DerivedDamageTerm[] = mode.damage.map((t) => {
      const dt = dtById.get(t.typeId);
      return { notation: t.notation, typeName: dt?.name ?? 'untyped', colour: dt?.colour ?? 'var(--text)', isScale: false };
    });
    if (dmgStat) {
      damage.push({ notation: `${statVal(dmgStat)}`, typeName: `scaling (${dmgStat})`, colour: 'var(--text-dim)', isScale: true });
    }
    const lname = mode.name.toLowerCase();
    const iname = item.name.toLowerCase();
    for (const b of dmgBonuses) {
      const v = b.scopeValue.toLowerCase();
      const match =
        (b.scope === 'tag' && item.tags.includes(b.scopeValue)) ||
        (b.scope === 'mode' && lname === v) ||
        (b.scope === 'name' && (lname === v || iname === v));
      if (!match) continue;
      const val = evalInt(b.formula, ctx);
      const dt = dtById.get(b.damageTypeId);
      damage.push({ notation: `${val}`, typeName: dt?.name ?? 'untyped', colour: dt?.colour ?? 'var(--text)', isScale: true });
    }
    return { name: mode.name, toHit, toHitStat: toHitStat || 'STR', damage };
  };

  const weapons: DerivedWeapon[] = [];
  for (const { item, slot, entryId } of equipped) {
    if (!item.weapon) continue;
    const modes: DerivedWeaponMode[] = item.weapon.modes.map((mode) => deriveMode(item, mode));
    for (const ag of addmodeGrants) {
      if (!ag.weaponTag || item.tags.includes(ag.weaponTag)) {
        modes.push(deriveMode(item, ag.mode));
      }
    }
    weapons.push({ entryId, itemName: item.name, slot: slot ?? 'none', modes });
  }
  const weaponBySlot: { main: DerivedWeapon | null; secondary: DerivedWeapon | null } = {
    main: weapons.find((w) => w.slot === 'main') ?? null,
    secondary: weapons.find((w) => w.slot === 'secondary') ?? null,
  };

  // Resources.
  const resources: DerivedResource[] = ruleset.resources.map((def) => {
    const grantAmt = resourceGrantAmt.get(def.id) ?? 0;
    const base = evalInt(def.maxFormula, ctx) + grantAmt;
    const v = resolveValue(base, stackOf(def.id), itemsOf(def.id));
    const granted = grantedResourceIds.has(def.id);
    return { def, baseMax: base, max: Math.max(0, v.effective), contributions: v.contributions, granted, visible: def.alwaysVisible || granted };
  });
  const resourceById: Record<string, DerivedResource> = {};
  for (const r of resources) resourceById[r.def.id] = r;

  // Skill budget.
  let skillInvested = 0;
  for (const tree of ruleset.trees) skillInvested += totalInvestedInTree(character.trees[tree.id]);
  const skillTotal = character.grantedSkillPoints;

  // Load.
  const perBag: Record<string, number> = {};
  let total = 0;
  for (const entry of character.inventory) {
    const item = itemsById.get(entry.itemId);
    if (!item) continue;
    const w = item.weight * entry.qty;
    perBag[entry.bagId] = (perBag[entry.bagId] ?? 0) + w;
    total += w;
  }

  return {
    level: character.level,
    prof,
    stats,
    hpMax,
    soulMax,
    ac,
    damageBonus,
    resources,
    resourceById,
    weapons,
    weaponBySlot,
    skillTotal,
    skillInvested,
    skillRemaining: skillTotal - skillInvested,
    overBudget: skillInvested > skillTotal,
    load: { total, perBag },
    ctx,
  };
}

export const FORMULA_VARS = ['level', 'STR', 'DEX', 'KNO', 'WIL', 'prof', 'crit', 'soul', 'damage'];
export const PROF_VARS = ['level'];
export const TOHIT_VARS = ['level', 'prof', 'scale', 'STR', 'DEX', 'KNO', 'WIL', 'crit'];
