// ──────────────────────────────────────────────────────────────────────────
// Character derivation — Revision 3.
//
// Adds: item grant modes (Set/Add/Multiply) with non-stacking per stat (Set
// priority); weapons with use-modes, dice damage split by type, and to-hit with
// configurable + skill-tag-scoped scaling.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ActionModifier,
  Character,
  CoreStat,
  GrantMode,
  ItemDef,
  LevelRow,
  ModifierTarget,
  Ruleset,
  SkillAction,
  Tier,
  WeaponMode,
  WeaponSlot,
} from '../types';
import { CORE_STATS } from '../types';
import { evalInt, interpolate, serializeWeaponTerms, type DmgPart, type DmgTypeInfo, type FormulaContext, type WeaponDamageRefs } from './formula';
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
  attackType: string;
  toHit: number;
  toHitStat: string;
  damage: DerivedDamageTerm[];
}

export interface DerivedWeapon {
  entryId: string;
  itemName: string;
  slot: string;
  modes: DerivedWeaponMode[];
  isTwoHanded: boolean;
  twoHandedGrip: boolean;
  shield?: { dr: number };
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
  actionExts: { actionTag: string; target?: string; range?: string; rangeAdd?: number; dmgAdd?: string }[];
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
  const addmodeGrants: { weaponTags: string[]; mode: WeaponMode }[] = [];
  const actionExts: { actionTag: string; target?: string; range?: string; rangeAdd?: number; dmgAdd?: string }[] = [];
  const dmgBonuses: { weaponTag: string; attackName: string; attackType: string; toHitBonus: string; formula: string; damageTypeId: string; scope?: string; scopeValue?: string }[] = [];
  const acSources: { low: string; high: string; name: string; mode: 'set' | 'adjust' }[] = [];

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
        } else if (g.kind === 'ac') acSources.push({ low: g.low, high: g.high, name: tree.name, mode: g.mode ?? 'set' });
        else if (g.kind === 'scaling') scalingGrants.push({ tag: g.tag, attackTag: g.attackTag ?? '', toHit: g.toHit, damage: g.damage });
        else if (g.kind === 'dmgbonus') dmgBonuses.push({ weaponTag: g.weaponTag ?? '', attackName: g.attackName ?? '', attackType: g.attackType ?? '', toHitBonus: g.toHitBonus ?? '', formula: g.formula, damageTypeId: g.damageTypeId, scope: g.scope, scopeValue: g.scopeValue });
        else if (g.kind === 'addmode') addmodeGrants.push({ weaponTags: g.weaponTags ?? (g.weaponTag ? [g.weaponTag] : []), mode: g.mode });
        else if (g.kind === 'actionext') actionExts.push({ actionTag: g.actionTag, target: g.target, range: g.range, rangeAdd: g.rangeAdd, dmgAdd: g.dmgAdd });
      }
    }
  }

  // Equipped items.
  const itemsById = new Map(ruleset.items.map((i) => [i.id, i]));
  const equipped: { item: ItemDef; slot: WeaponSlot | null; entryId: string; twoHandedGrip: boolean }[] = [];
  for (const entry of character.inventory) {
    if (!entry.equipped) continue;
    const item = itemsById.get(entry.itemId);
    if (!item) continue;
    equipped.push({ item, slot: entry.weaponSlot, entryId: entry.id, twoHandedGrip: entry.twoHandedGrip ?? false });
    for (const g of item.grants) {
      if (g.kind === 'modifier') addItem(g.target, { id: g.id, name: item.name, value: g.value, mode: g.mode });
      else if (g.kind === 'resource') {
        grantedResourceIds.add(g.resourceId);
        resourceGrantAmt.set(g.resourceId, (resourceGrantAmt.get(g.resourceId) ?? 0) + g.amount);
      } else if (g.kind === 'ac') acSources.push({ low: g.low, high: g.high, name: item.name, mode: g.mode ?? 'set' });
      else if (g.kind === 'scaling') scalingGrants.push({ tag: g.tag, attackTag: g.attackTag ?? '', toHit: g.toHit, damage: g.damage });
      else if (g.kind === 'dmgbonus') dmgBonuses.push({ weaponTag: g.weaponTag ?? '', attackName: g.attackName ?? '', attackType: g.attackType ?? '', toHitBonus: g.toHitBonus ?? '', formula: g.formula, damageTypeId: g.damageTypeId, scope: g.scope, scopeValue: g.scopeValue });
      else if (g.kind === 'addmode') addmodeGrants.push({ weaponTags: g.weaponTags ?? (g.weaponTag ? [g.weaponTag] : []), mode: g.mode });
      else if (g.kind === 'actionext') actionExts.push({ actionTag: g.actionTag, target: g.target, range: g.range, rangeAdd: g.rangeAdd, dmgAdd: g.dmgAdd });
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
  // Expose current resource values so action effect formulas can reference them (e.g. {{aim * main}}).
  for (const [id, val] of Object.entries(character.resourceState)) {
    if (!Object.prototype.hasOwnProperty.call(ctx, id)) ctx[id] = val ?? 0;
  }

  const hpMax = resolveValue(evalInt(ruleset.formulas.hpMax, ctx), stackOf('hpMax'), itemsOf('hpMax'));
  const soulMax = resolveValue(evalInt(ruleset.formulas.soulMax, ctx), stackOf('soulMax'), itemsOf('soulMax'));

  // AC range: pick best 'set' source, apply 'adjust' deltas, then modifier stack.
  let ac: DerivedAC | null = null;
  const setAcSources = acSources.filter((s) => s.mode === 'set');
  const adjAcSources = acSources.filter((s) => s.mode === 'adjust');
  // Resolve unarmored AC with new low/high fields, falling back to legacy unarmoredAC.
  const uacLowFormula = (ruleset.unarmoredACLow ?? ruleset.unarmoredAC ?? '').trim();
  const uacHighFormula = (ruleset.unarmoredACHigh ?? ruleset.unarmoredACLow ?? ruleset.unarmoredAC ?? '').trim();
  const hasUnarmoredAC = uacLowFormula.length > 0;
  if (setAcSources.length || hasUnarmoredAC) {
    let best: { low: number; high: number; name: string } | null = null;
    if (setAcSources.length) {
      for (const s of setAcSources) {
        const low = evalInt(s.low, ctx);
        const high = evalInt(s.high, ctx);
        if (!best || high > best.high) best = { low, high, name: s.name };
      }
    } else {
      best = { low: evalInt(uacLowFormula, ctx), high: evalInt(uacHighFormula, ctx), name: 'Unarmored' };
    }
    if (best) {
      let adjLow = 0, adjHigh = 0;
      for (const adj of adjAcSources) {
        adjLow += evalInt(adj.low, ctx);
        adjHigh += evalInt(adj.high, ctx);
      }
      const modAdj = resolveValue(0, stackOf('ac'), itemsOf('ac'));
      ac = {
        baseLow: best.low + adjLow,
        baseHigh: best.high + adjHigh,
        low: best.low + adjLow + modAdj.effective,
        high: best.high + adjHigh + modAdj.effective,
        contributions: modAdj.contributions,
        armourName: best.name,
      };
    }
  }

  // Weapons.
  const statVal = (s: CoreStat | ''): number => (s ? stats[s].effective : 0);
  const dtById = new Map(ruleset.damageTypes.map((d) => [d.id, d]));

  // Returns true if a comma-separated tag string (may contain 'main'/'secondary') matches item+slot.
  const tagsMatch = (tagStr: string, item: ItemDef, slot: WeaponSlot | null): boolean => {
    if (!tagStr) return true;
    const parts = tagStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return true;
    return parts.some((t) =>
      (t === 'main' && slot === 'main') ||
      (t === 'secondary' && slot === 'secondary') ||
      item.tags.map((x) => x.toLowerCase()).includes(t),
    );
  };

  const deriveMode = (item: ItemDef, mode: WeaponMode, slot: WeaponSlot | null, twoHandedGrip = false): DerivedWeaponMode => {
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

    // Use two-handed damage when the player has toggled into 2H grip.
    const activeDamage =
      twoHandedGrip && mode.damageTwoHanded?.length
        ? mode.damageTwoHanded
        : mode.damage;

    // Build base damage: inherit damage type left-to-right when a die has no explicit type.
    const rawDamage: DerivedDamageTerm[] = [];
    let currentTypeId = '';
    for (const t of activeDamage) {
      if (t.typeId) currentTypeId = t.typeId;
      const dt = dtById.get(currentTypeId);
      rawDamage.push({ notation: t.notation, typeName: dt?.name ?? 'untyped', colour: dt?.colour ?? 'var(--text)', isScale: false });
    }
    if (dmgStat) {
      const scaleDt = dtById.get(currentTypeId);
      rawDamage.push({ notation: `${statVal(dmgStat)}`, typeName: scaleDt?.name ?? 'untyped', colour: scaleDt?.colour ?? 'var(--text-dim)', isScale: true });
    }

    const lname = mode.name.toLowerCase();
    const mtype = (mode.attackType ?? '').toLowerCase();
    let toHitFinal = toHit;
    for (const b of dmgBonuses) {
      const tagOk = tagsMatch(b.weaponTag, item, slot);
      const nameOk = !b.attackName || lname === b.attackName.toLowerCase();
      const typeOk = !b.attackType || mtype === b.attackType.toLowerCase();
      let match: boolean;
      if (!b.weaponTag && !b.attackName && !b.attackType && b.scope && b.scopeValue) {
        // Legacy compat for old scope/scopeValue saves.
        const v = b.scopeValue.toLowerCase();
        const iname = item.name.toLowerCase();
        match = (b.scope === 'tag' && item.tags.includes(b.scopeValue)) || (b.scope === 'mode' && lname === v) || (b.scope === 'name' && (lname === v || iname === v));
      } else {
        match = tagOk && nameOk && typeOk;
      }
      if (!match) continue;
      if (b.toHitBonus) toHitFinal += evalInt(b.toHitBonus, ctx);
      const val = evalInt(b.formula, ctx);
      // If no damageTypeId specified, inherit the last explicit type from the base dice.
      const effectiveDmgTypeId = b.damageTypeId || currentTypeId;
      const dt = dtById.get(effectiveDmgTypeId);
      rawDamage.push({ notation: `${val}`, typeName: dt?.name ?? 'untyped', colour: dt?.colour ?? 'var(--text)', isScale: true });
    }

    // Combine same-type terms: sum flat integers, keep dice notations separate.
    const acc = new Map<string, { typeName: string; colour: string; isScale: boolean; dice: string[]; flat: number }>();
    for (const term of rawDamage) {
      if (!acc.has(term.typeName)) acc.set(term.typeName, { typeName: term.typeName, colour: term.colour, isScale: term.isScale, dice: [], flat: 0 });
      const a = acc.get(term.typeName)!;
      const n = Number(term.notation);
      if (Number.isFinite(n) && /^-?\d+$/.test(term.notation)) {
        a.flat += n;
      } else {
        a.dice.push(term.notation);
      }
      if (!term.isScale) a.isScale = false;
    }
    const damage: DerivedDamageTerm[] = [...acc.values()].map((a) => {
      let notation = a.dice.join('+');
      if (a.flat > 0) notation = notation ? `${notation}+${a.flat}` : `${a.flat}`;
      else if (a.flat < 0) notation = notation ? `${notation}${a.flat}` : `${a.flat}`;
      return { notation: notation || '0', typeName: a.typeName, colour: a.colour, isScale: a.isScale };
    });

    return { name: mode.name, attackType: mode.attackType ?? '', toHit: toHitFinal, toHitStat: toHitStat || 'STR', damage };
  };

  const weapons: DerivedWeapon[] = [];
  for (const { item, slot, entryId, twoHandedGrip } of equipped) {
    if (item.shield) {
      const dr = evalInt(item.shield.dr, ctx);
      weapons.push({ entryId, itemName: item.name, slot: slot ?? 'none', modes: [], isTwoHanded: false, twoHandedGrip: false, shield: { dr } });
      continue;
    }
    if (!item.weapon) continue;
    const modes: DerivedWeaponMode[] = item.weapon.modes.map((mode) => deriveMode(item, mode, slot, twoHandedGrip));
    for (const ag of addmodeGrants) {
      const tags = ag.weaponTags;
      const match = !tags.length || tags.some((t) => {
        const tl = t.toLowerCase();
        return (tl === 'main' && slot === 'main') || (tl === 'secondary' && slot === 'secondary') || item.tags.includes(t);
      });
      if (match) modes.push(deriveMode(item, ag.mode, slot, twoHandedGrip));
    }
    weapons.push({ entryId, itemName: item.name, slot: slot ?? 'none', modes, isTwoHanded: item.tags.includes('two-handed'), twoHandedGrip });
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
    actionExts,
  };
}

export interface ComposedAttack {
  toHit: number;
  parts: DmgPart[];
  modified: boolean; // true when an action transform or active modifier changed the base attack
}

/**
 * Compose an attack's displayed to-hit and damage from the linked weapon mode, the action's own
 * additive transform (e.g. Heavy Attack "4 * main"), and an optionally-active modifier. Reuses the
 * `{{ }}` damage pipeline so dice/flat/type grouping and `main`/`side` refs all work consistently.
 */
export function composeAttack(
  twMode: DerivedWeaponMode,
  action: Pick<SkillAction, 'attackDamage' | 'attackToHit'>,
  modifiers: ActionModifier[],
  ctx: FormulaContext,
  damageTypes: DmgTypeInfo[],
  weaponRefs: WeaponDamageRefs,
): ComposedAttack {
  const actionExpr = (action.attackDamage ?? '').trim();
  const modExprs = modifiers.map((m) => (m.attackDamage ?? '').trim()).filter(Boolean);
  const actionHit = (action.attackToHit ?? '').trim();
  const modHits = modifiers.map((m) => (m.attackToHit ?? '').trim()).filter(Boolean);
  const modified = !!(actionExpr || modExprs.length || actionHit || modHits.length);

  // Base damage: the action's own expression if set, else the derived weapon mode damage.
  const baseExpr = actionExpr || serializeWeaponTerms(twMode.damage, 1);
  const fullExpr = [baseExpr, ...modExprs].filter(Boolean).join(' + ');
  const parts: DmgPart[] = [];
  for (const seg of interpolate(`{{${fullExpr}}}`, ctx, damageTypes, weaponRefs)) {
    if (seg.kind === 'dmg') parts.push(...seg.parts);
  }

  let toHit = twMode.toHit;
  if (actionHit) toHit += evalInt(actionHit, ctx);
  for (const mh of modHits) toHit += evalInt(mh, ctx);
  return { toHit, parts, modified };
}

export const FORMULA_VARS = ['level', 'STR', 'DEX', 'KNO', 'WIL', 'prof', 'crit', 'soul', 'damage'];
export const PROF_VARS = ['level'];
export const TOHIT_VARS = ['level', 'prof', 'scale', 'STR', 'DEX', 'KNO', 'WIL', 'crit'];
