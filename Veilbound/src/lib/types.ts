// ──────────────────────────────────────────────────────────────────────────
// Veilbound data model — Revision 2
//
// Two top-level documents live in the browser:
//   • Ruleset    — authored by the GM (trees, items, formulas, level table,
//                  resources, rule-tag definitions, global tag registry)
//   • Character  — authored by a player; references the ruleset by stable IDs.
//                  A ruleset change never destroys player data.
// ──────────────────────────────────────────────────────────────────────────

export type CoreStat = 'STR' | 'DEX' | 'KNO' | 'WIL';
export const CORE_STATS: CoreStat[] = ['STR', 'DEX', 'KNO', 'WIL'];
export const CORE_STAT_LABELS: Record<CoreStat, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  KNO: 'Knowledge',
  WIL: 'Willpower',
};

/** Stat tiers. Each core stat maps to one tier at character creation (§10.1). */
export type Tier = 'pri' | 'sec' | 'tert' | 'quat';
export const TIERS: Tier[] = ['pri', 'sec', 'tert', 'quat'];
export const TIER_LABELS: Record<Tier, string> = {
  pri: 'Primary',
  sec: 'Secondary',
  tert: 'Tertiary',
  quat: 'Quaternary',
};

/**
 * A modifier/grant can target a core stat, a derived value, or a resource by
 * id. Special keys: 'hpMax', 'soulMax', 'ac', 'damage'. Anything else is a
 * resource id (targets that resource's max).
 */
export type ModifierTarget = string;
export const FIXED_MODIFIER_TARGETS = ['STR', 'DEX', 'KNO', 'WIL', 'hpMax', 'soulMax', 'ac', 'damage'] as const;
export const MODIFIER_TARGET_LABELS: Record<string, string> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  KNO: 'Knowledge',
  WIL: 'Willpower',
  hpMax: 'Max HP',
  soulMax: 'Max Soul',
  ac: 'Armour Class',
  damage: 'Damage bonus',
};

// ── Level-up table ───────────────────────────────────────────────────────────
/**
 * One row of the level-up table, written in TIER terms (§10.2). Cells are
 * INCREMENTS; null = empty = no change. The level-1 row holds base values.
 */
export interface LevelRow {
  level: number; // 1..20
  pri: number | null;
  sec: number | null;
  tert: number | null;
  quat: number | null;
  soul: number | null;
}
export const TIER_KEYS: Tier[] = TIERS;

// ── Formulas ─────────────────────────────────────────────────────────────────
/**
 * Editable formula strings, evaluated by the safe parser (never eval).
 * `prof` is computed first (inputs: level), then is available to the rest.
 * Other inputs: level, STR, DEX, KNO, WIL (effective), prof, crit, soul.
 */
export interface Formulas {
  prof: string;
  hpMax: string;
  soulMax: string;
}

// ── Resources ────────────────────────────────────────────────────────────────
export type ResourceType = 'dots' | 'number' | 'bar';

/** A rechargeable resource. Mana is just a resource granted by a skill (§0). */
export interface ResourceDef {
  id: string;
  label: string;
  type: ResourceType;
  maxFormula: string; // evaluated per character; e.g. "3" or "KNO*4+WIL*2"
  colour: string;
  shortRest: number; // amount restored on a short rest (§9)
  longRest: number; // amount restored on a long rest
  alwaysVisible: boolean; // false = only shown once granted by a skill
}

// ── Tags ─────────────────────────────────────────────────────────────────────
/** A rule tag (e.g. finesse) with a player-facing explanation (§5.2). */
export interface RuleTagDef {
  tag: string;
  description: string;
}

// ── Grants (skills & items both grant via this union) ───────────────────────
/** How a modifier grant combines (§10). Items are non-stacking per stat. */
export type GrantMode = 'add' | 'set' | 'mul';
export const GRANT_MODES: GrantMode[] = ['add', 'set', 'mul'];
export const GRANT_MODE_LABELS: Record<GrantMode, string> = { add: 'Add', set: 'Set', mul: 'Multiply' };

/** Scope + shape of an item's scoped damage bonus (§2, rev4). */
export type DmgScope = 'tag' | 'name' | 'mode';
export const DMG_SCOPES: DmgScope[] = ['tag', 'name', 'mode'];
export const DMG_SCOPE_LABELS: Record<DmgScope, string> = { tag: 'Weapon tag', name: 'Attack name', mode: 'Attack type (mode)' };
export type Grant =
  | { id: string; kind: 'resource'; resourceId: string; amount: number }
  | { id: string; kind: 'modifier'; target: ModifierTarget; value: number; mode: GrantMode }
  | { id: string; kind: 'ac'; low: string; high: string }
  | { id: string; kind: 'scaling'; tag: string; attackTag: string; toHit: CoreStat | ''; damage: CoreStat | '' }
  // Scoped damage bonus: formula evaluated against character stats, added as a flat term to matching attacks.
  | { id: string; kind: 'dmgbonus'; scope: DmgScope; scopeValue: string; formula: string; damageTypeId: string }
  // Grant an extra weapon use-mode to all equipped weapons matching weaponTag (empty = all weapons).
  | { id: string; kind: 'addmode'; weaponTag: string; mode: WeaponMode };

// ── Actions ──────────────────────────────────────────────────────────────────
/** A resource interaction shown as a badge on an action (§3). */
export interface ActionResourceUse {
  resourceId: string;
  mode: 'consume' | 'grant';
  amount: number;
}

export interface SkillAction {
  id: string;
  name: string;
  cost: string; // "1 Action" / "2 Actions" / "Reaction" (§4)
  findingTags: string[]; // hidden except in search (§5.1)
  ruleTags: string[]; // always shown; hover for definition
  flavour: string;
  effect: string; // may contain {{formula}} interpolation (§3)
  resource: ActionResourceUse | null;
  weaponTarget: '' | 'main' | 'secondary'; // pull numbers from this weapon slot (§3)
  weaponMode: string; // optional use-mode name to target
}

// ── Skill trees (free-form node graph, auto-laid-out) ───────────────────────
export interface SkillNode {
  id: string;
  name: string;
  cost: number;
  description: string;
  prerequisite: string; // narrative gate — only prompts the player when set (§8)
  prereqNodeIds: string[]; // graph edges; a node with several is a merge (any one suffices, §7)
  exclusive: boolean; // if this node branches, are the branches mutually exclusive?
  actions: SkillAction[];
  grants: Grant[];
  // Per-node visibility toggles (§8): independently hide each part from players.
  hideName: boolean;
  hideDescription: boolean;
  hidePrerequisite: boolean;
}

export type TreeStatus = 'inProgress' | 'done';

export interface SkillTree {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: string; // GM-set grouping (§9, §11.1)
  status: TreeStatus; // only 'done' trees show to players
  nodes: SkillNode[];
}

// ── Damage types & weapons ───────────────────────────────────────────────────
export interface DamageType {
  id: string;
  name: string;
  colour: string;
}

/** One term of a weapon's damage, e.g. "2d6" slashing (§4). */
export interface DamageTerm {
  id: string;
  notation: string; // dice notation or flat number, e.g. "2d6", "1d4", "5"
  typeId: string; // references a DamageType
}

/** A way to use a weapon (slash, thrust, …) — GM defines any number (§4). */
export interface WeaponMode {
  id: string;
  name: string;
  attackType: string; // attack-type tag (e.g. "thrust", "slash") — empty = untagged
  damage: DamageTerm[];
  scaleToHit: CoreStat | ''; // '' = use weapon/global default
  scaleDamage: CoreStat | '';
  toHitBonus: number;
}

export interface WeaponDef {
  // The Main/Secondary slot is assigned by the player per equipped weapon
  // (InventoryEntry.weaponSlot, §3 rev4), not fixed on the item.
  modes: WeaponMode[];
}

// ── Items / inventory ────────────────────────────────────────────────────────
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  level: number;
  category: string; // grouping for admin/shop (§10)
  tags: string[];
  weight: number;
  flavour: string;
  grants: Grant[]; // applied only while equipped (§5)
  actions: SkillAction[]; // actions an item grants (shown when expanded)
  weapon: WeaponDef | null;
}

// ── Ruleset ──────────────────────────────────────────────────────────────────
export interface Ruleset {
  schema: number;
  version: number;
  name: string;
  password: string;
  levelTable: LevelRow[];
  formulas: Formulas;
  hpShortRest: number; // HP restored on short/long rest (§9)
  hpLongRest: number;
  resources: ResourceDef[];
  trees: SkillTree[];
  items: ItemDef[];
  ruleTags: RuleTagDef[];
  damageTypes: DamageType[];
  tags: string[]; // global tag registry (pick-or-create, §5)
  categories: string[]; // known tree categories
  itemCategories: string[]; // known item categories
  /** Global to-hit formula; scaling stat is configurable per weapon/mode (§11.3). */
  toHitFormula: string;
}

// ── Character ────────────────────────────────────────────────────────────────
export interface Modifier {
  id: string;
  target: ModifierTarget;
  name: string;
  value: number;
}

export interface TreeProgress {
  prereqMet: Record<string, boolean>; // nodeId -> answered (only when a node has a prereq)
  invested: Record<string, number>; // nodeId -> points poured in
}

/** A user-named column in a tab's custom layout (§3). */
export interface ActionColumn {
  id: string;
  name: string;
  members: string[]; // action names assigned to this column
}

export type TabLayout = 'list' | 'cost' | 'custom';

/** Action view tab (one level of nesting allowed, §7). */
export interface ActionTab {
  id: string;
  name: string;
  tags: string[];
  names: string[]; // explicit action names added by drag/typing (§3)
  matchMode: 'all' | 'any';
  showDescriptions: boolean;
  layout: TabLayout;
  columnSize: number;
  columns: ActionColumn[];
  costOrder?: string[];   // saved column order for 'cost' layout
  unsortedLabel: string;  // label for the catch-all column in custom layout
  hideUnsorted: boolean;  // hide the catch-all column in custom layout
  children: ActionTab[];
}

/** A user-defined tab in the skills browser (§1). */
export interface SkillTab {
  id: string;
  name: string;
  treeIds: string[];
}

export interface Bag {
  id: string;
  name: string;
  column: number; // which display column this bag lives in (0-indexed)
}

export type WeaponSlot = 'main' | 'secondary';

export interface InventoryEntry {
  id: string; // instance id
  itemId: string;
  bagId: string;
  equipped: boolean;
  qty: number;
  weaponSlot: WeaponSlot | null; // player-assigned Main/Secondary (§3 rev4)
}

export interface Character {
  id: string;
  name: string;
  level: number;
  crit: number; // -6..+6
  statTiers: Record<CoreStat, Tier>;
  hpCurrent: number;
  soulCurrent: number;
  grantedSkillPoints: number; // from the sheet button (§10.3)
  modifiers: Modifier[];
  resourceState: Record<string, number>;
  trees: Record<string, TreeProgress>;
  inventory: InventoryEntry[];
  bags: Bag[];
  actionTabs: ActionTab[];
  skillTabs: SkillTab[];        // used by SkillBrowser page
  sheetSkillTabs: SkillTab[];   // used by CharacterSheet skills section
  seenRulesetVersion: number;
}
