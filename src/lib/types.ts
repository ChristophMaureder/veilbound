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
export type AcGrantMode = 'set' | 'adjust';
export type Grant =
  | { id: string; kind: 'resource'; resourceId: string; amount: number }
  | { id: string; kind: 'modifier'; target: ModifierTarget; value: number; mode: GrantMode }
  | { id: string; kind: 'ac'; low: string; high: string; mode?: AcGrantMode }
  | { id: string; kind: 'scaling'; tag: string; attackTag: string; toHit: CoreStat | ''; damage: CoreStat | '' }
  // Scoped damage bonus: formula evaluated against character stats, added as a flat term to matching attacks.
  // All non-empty filter fields must match (AND logic). Legacy scope/scopeValue kept for saved-data compat.
  | { id: string; kind: 'dmgbonus'; weaponTag: string; attackName: string; attackType: string; toHitBonus: string; formula: string; damageTypeId: string; scope?: DmgScope; scopeValue?: string }
  // Grant an extra weapon use-mode to equipped weapons matching any of weaponTags (empty = all weapons).
  | { id: string; kind: 'addmode'; weaponTags: string[]; mode: WeaponMode; weaponTag?: string }
  // Grant an attack modifier (selectable at play time on matching action cards).
  | { id: string; kind: 'attackmod'; modifier: ActionModifier }
  // Extend target or range on actions matching a rule tag.
  // rangeAdd: permanent ft added to numeric base range (shown on spell card).
  // dmgAdd: permanent damage text shown as a badge on spell card (e.g. "+1 Fire").
  | { id: string; kind: 'actionext'; actionTag: string; target?: string; range?: string; rangeAdd?: number; dmgAdd?: string };

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
  showWeaponInfo?: boolean; // false = hide the weapon stats line on the card (default true)
  // The action's own additive transform of the linked weapon attack. Empty = use the weapon as-is.
  attackDamage?: string; // additive damage expr, e.g. "3 * main" (Heavy) or "2d8 fire"
  attackToHit?: string;  // additive to-hit bonus formula
  target?: string;       // who / what can be targeted (e.g. "1 creature", "self")
  range?: string;        // range (e.g. "30 ft", "60 ft")
  reach?: string;        // melee reach distance, separate from range (e.g. "5 ft", "10 ft")
  isSpell?: boolean;     // marks action as a spell for display + modifier targeting
}

/**
 * A play-time modifier the player can toggle onto a matching action card (§attack modifiers).
 * Additively changes the linked attack's damage/to-hit, may add drawback tags, and may cost a
 * resource. Authored globally (ruleset.modifiers) or granted by skills/items via an 'attackmod'
 * grant. One modifier may be active per action card at a time.
 */
export interface ActionModifier {
  id: string;
  name: string;
  targetMode: 'tags' | 'spells'; // how this modifier matches actions
  actionTags: string[];           // used when targetMode === 'tags' — action must have ≥1 of these in ruleTags
  spellNames: string[];           // used when targetMode === 'spells' — matches by action name (case-insensitive)
  attackType: string;    // optional weapon attack-type restriction (empty = any)
  attackDamage: string;  // additive damage expr (dice/flat/main/side/types), empty = none
  attackToHit: string;   // additive to-hit formula, empty = none
  addRuleTags: string[]; // tags added to the action while active (e.g. 'defenseless')
  effect: string;        // descriptive text shown when active (may contain {{}})
  flavour: string;
  resource: ActionResourceUse | null; // extra cost/grant
  stackable?: boolean;           // true = spell modifier (multi-select layers); false/undefined = martial modifier (radio-select)
  replacesModifierId?: string;   // when this modifier is available, hide the modifier with this id (upgrade chain)
  // Spell modifier fields — only meaningful when stackable === true:
  spellDamageAdd?: string;       // extra damage shown on spell card while active (e.g. "+2d6 Fire")
  spellRangeAdd?: number;        // ft added to numeric range when base is parseable (e.g. 15 → "30 ft")
  spellRangeOverride?: string;   // absolute range replacement — takes priority over spellRangeAdd
  spellTargetsAdd?: number;      // count added to leading number in target text (e.g. +1 → "3 creatures")
  spellTargetsOverride?: string; // absolute target replacement
  spellTargetsPerMana?: number;  // targets added per mana spent (enables variable mana UI)
  spellManaMax?: number;         // max mana spendable for spellTargetsPerMana (undefined = unlimited)
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
export type TreeType = 'skill' | 'spell';
export type TreeRarity = 'basic' | 'expert' | 'legendary';

/** Per-rarity cost arrays (10 levels, indexed by node depth 0–9; deeper nodes clamp to last). */
export interface TreeProgressionCosts {
  skill: Record<TreeRarity, number[]>;
  spell: Record<TreeRarity, number[]>;
}

/**
 * A structured, hard requirement gating a whole tree (separate from a node's
 * narrative `prerequisite`). Unmet requirements lock the tree from investment
 * until the player explicitly unlocks it (TreeProgress.unlocked).
 *   • treeLevel  — ≥min owned nodes in another tree
 *   • subcatLevel— ≥count trees in a subcategory each with ≥level owned nodes
 *   • stat       — ≥min in an effective core stat
 */
export type TreeRequirement =
  | { id: string; kind: 'treeLevel'; treeId: string; min: number }
  | { id: string; kind: 'subcatLevel'; subcategory: string; level: number; count: number }
  | { id: string; kind: 'stat'; stat: CoreStat; min: number };
export const TREE_REQ_KINDS = ['treeLevel', 'subcatLevel', 'stat'] as const;
export const TREE_REQ_KIND_LABELS: Record<string, string> = {
  treeLevel: 'Levels in a tree',
  subcatLevel: 'Trees in a subcategory',
  stat: 'Core stat',
};

export interface SkillTree {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: string;       // GM-set grouping (§9, §11.1)
  subcategory?: string;   // optional second-level grouping within category
  status: TreeStatus; // only 'done' trees show to players
  treeType?: TreeType;    // 'skill' | 'spell' (default 'skill')
  rarity?: TreeRarity;    // 'basic' | 'expert' | 'legendary' (default 'basic')
  nodes: SkillNode[];
  requirements?: TreeRequirement[]; // structured gate; empty/undefined = no gate
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
  damageTwoHanded?: DamageTerm[]; // used instead of damage when weapon has 'two-handed' tag
  scaleToHit: CoreStat | ''; // '' = use weapon/global default
  scaleDamage: CoreStat | '';
  toHitBonus: number;
}

export interface WeaponDef {
  // The Main/Secondary slot is assigned by the player per equipped weapon
  // (InventoryEntry.weaponSlot, §3 rev4), not fixed on the item.
  modes: WeaponMode[];
}

export interface ShieldDef {
  dr: string; // damage reduction formula, e.g. "2" or "floor(STR / 4)"
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
  shield: ShieldDef | null;
}

// ── Presets (GM-authored character starting points) ──────────────────────────
/**
 * A reusable starting point a player can apply — wholesale at character creation
 * (a "template") or one section at a time on an existing character. Any section
 * may be omitted; only present sections are applied.
 */
export interface Preset {
  id: string;
  name: string;
  description: string;
  statTiers?: Record<CoreStat, Tier>; // suggested tiers; player reviews at creation
  standardActionIds?: string[];       // standard actions kept visible (others hidden)
  actionTabs?: ActionTab[];           // action tabs to seed
  skillTabs?: SkillTab[];             // skill-browser tabs to seed (columns = focus order)
  pinnedTreeIds?: string[];           // suggested trees (added into a generated skill tab)
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
  unarmoredAC?: string;    // legacy single-value unarmored AC formula (migrated to low/high below)
  unarmoredACLow?: string;  // low end of unarmored AC range; empty = no unarmored AC
  unarmoredACHigh?: string; // high end of unarmored AC range; defaults to unarmoredACLow if omitted
  resources: ResourceDef[];
  trees: SkillTree[];
  items: ItemDef[];
  standardActions: SkillAction[]; // global actions every character owns
  modifiers: ActionModifier[];    // global attack-modifier pool (toggled on action cards)
  presets: Preset[];              // GM-authored character starting points
  ruleTags: RuleTagDef[];
  damageTypes: DamageType[];
  treeProgressionCosts: TreeProgressionCosts; // default node costs by type × rarity × depth
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
  unlocked?: boolean; // player override of an unmet structured requirement gate
}

/** A user-named column in a tab's custom layout (§3). */
export interface ActionColumn {
  id: string;
  name: string;
  members: string[]; // action names assigned to this column
}

export type TabLayout = 'list' | 'cost' | 'custom';

export type ActionTabKind = 'all' | 'standard' | 'normal';

/** Action view tab (one level of nesting allowed, §7). */
export interface ActionTab {
  id: string;
  name: string;
  kind?: ActionTabKind; // built-in special tabs ('all'/'standard'); default 'normal'
  hidden?: boolean;     // hidden from players in play; shown dotted while editing
  tags: string[];
  names: string[]; // explicit action names added by drag/typing (§3)
  categories: string[]; // source categories to include (tree category or item category)
  matchMode: 'all' | 'any';
  showDescriptions: boolean;
  showSource?: boolean;    // show the source skill tree/item name on each action card
  defaultInclude: boolean; // true = show all actions when no filters match
  layout: TabLayout;
  columnSize: number;
  columns: ActionColumn[];
  costOrder?: string[];   // saved column order for 'cost' layout
  unsortedLabel: string;  // label for the catch-all column in custom layout
  hideUnsorted: boolean;  // hide the catch-all column in custom layout
  children: ActionTab[];
}

export interface SkillTabColumn {
  id: string;
  name: string;
  treeIds: string[]; // tree IDs placed in this column
}

/** A user-defined tab in the skills browser (§1). */
export interface SkillTab {
  id: string;
  name: string;
  treeIds: string[];          // legacy: explicit tree IDs pinned to this tab
  defaultInclude?: boolean;   // true = show all trees; false = only matched ones
  nameFilters?: string[];     // trees whose name (case-insensitive) is in this list
  tagFilters?: string[];      // trees that have any of these tags
  categoryFilters?: string[]; // trees whose category or subcategory is in this list
  viewMode?: 'category' | 'all' | 'columns';
  columns?: SkillTabColumn[];
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
  twoHandedGrip?: boolean; // true = using a two-handed weapon with both hands
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
  hiddenStandardActionIds: string[]; // standard actions this character hides
  seenRulesetVersion: number;
}
