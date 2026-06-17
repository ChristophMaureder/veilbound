// ──────────────────────────────────────────────────────────────────────────
// Seed ruleset + character factory — Revision 3.
//
// The level-up table starts EMPTY (§11.2) — the GM fills it. Everything else is
// seeded richly: free-form trees with grants/actions, damage types, items
// (armour / weapon with use-modes / ring with grant modes), and mana-as-resource.
// ──────────────────────────────────────────────────────────────────────────

import type {
  Bag,
  Character,
  CoreStat,
  DamageType,
  ItemDef,
  LevelRow,
  ResourceDef,
  RuleTagDef,
  Ruleset,
  SkillAction,
  SkillNode,
  SkillTree,
  Tier,
} from './types';
import { uid } from './util';

export const STORAGE_KEYS = {
  ruleset: 'veilbound.ruleset.v3',
  characters: 'veilbound.characters.v3',
  active: 'veilbound.activeCharacter.v3',
} as const;

export const RULESET_SCHEMA = 3;

/** Level-up table starts empty (§11.2): 20 rows, every cell null. */
function buildLevelTable(): LevelRow[] {
  return Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    pri: null,
    sec: null,
    tert: null,
    quat: null,
    soul: null,
  }));
}

let counter = 0;
const sid = (p: string) => `${p}_${++counter}`;

function action(p: Partial<SkillAction> & { name: string }): SkillAction {
  return {
    id: sid('act'),
    name: p.name,
    cost: p.cost ?? '1 Action',
    findingTags: p.findingTags ?? [],
    ruleTags: p.ruleTags ?? [],
    flavour: p.flavour ?? '',
    effect: p.effect ?? '',
    resource: p.resource ?? null,
    weaponTarget: p.weaponTarget ?? '',
    weaponMode: p.weaponMode ?? '',
  };
}

function node(p: Partial<SkillNode> & { id: string }): SkillNode {
  return {
    id: p.id,
    name: p.name ?? '',
    cost: p.cost ?? 2,
    description: p.description ?? '',
    prerequisite: p.prerequisite ?? '',
    prereqNodeIds: p.prereqNodeIds ?? [],
    exclusive: p.exclusive ?? false,
    actions: p.actions ?? [],
    grants: p.grants ?? [],
    hideName: p.hideName ?? false,
    hideDescription: p.hideDescription ?? false,
    hidePrerequisite: p.hidePrerequisite ?? false,
  };
}

// ── Trees ─────────────────────────────────────────────────────────────────────
function longswordTree(): SkillTree {
  const nodes: SkillNode[] = [
    node({ id: 'ls1', name: 'Longsword Training', cost: 2, description: 'Wield a longsword and add proficiency to attacks.',
      actions: [action({ name: 'Measured Strike', cost: '1 Action', findingTags: ['longsword'], ruleTags: ['attack', 'martial'], flavour: 'A clean, controlled cut.', effect: 'On a hit, deal {{STR * 2 + damage}} damage.' })] }),
    node({ id: 'ls2', name: 'Sure Footing', prereqNodeIds: ['ls1'], description: '+1 AC while wielding a longsword.', grants: [{ id: sid('g'), kind: 'modifier', target: 'ac', value: 1, mode: 'add' }] }),
    node({ id: 'ls3', name: 'Power Training', prereqNodeIds: ['ls2'], description: '+1 damage.', grants: [{ id: sid('g'), kind: 'modifier', target: 'damage', value: 1, mode: 'add' }] }),
    node({ id: 'ls4', name: 'Finesse Forms', prereqNodeIds: ['ls3'], description: 'All longsword attacks may scale off Dexterity.', grants: [{ id: sid('g'), kind: 'scaling', tag: 'longsword', attackTag: 'longsword', toHit: 'DEX', damage: 'DEX' }] }),
    node({ id: 'ls5', name: 'Riposte', prereqNodeIds: ['ls3'], cost: 3, description: 'Punish a miss.',
      actions: [action({ name: 'Riposte', cost: 'Reaction', findingTags: ['longsword'], ruleTags: ['reaction', 'martial'], effect: 'When an attacker misses you, strike for {{STR + damage}} damage.' })] }),
    node({ id: 'ls6', name: 'Whirlwind', prereqNodeIds: ['ls4', 'ls5'], cost: 4, description: 'Sweep all adjacent foes (reachable from either path).',
      actions: [action({ name: 'Whirlwind', cost: '2 Actions', findingTags: ['longsword'], ruleTags: ['attack', 'aoe'], effect: 'Hit every adjacent creature for {{STR + damage}} damage.' })] }),
    node({ id: 'ls7', name: 'Bladestorm', prereqNodeIds: ['ls6'], cost: 4, hideDescription: true, description: 'Secret technique.' }),
    node({ id: 'ls8', name: 'Perfect Form', prereqNodeIds: ['ls7'], cost: 5, hideName: true, hideDescription: true, description: 'Your crits devastate.', grants: [{ id: sid('g'), kind: 'modifier', target: 'hpMax', value: 10, mode: 'add' }] }),
  ];
  return { id: 'tree_longsword', name: 'Longsword Mastery', description: 'The disciplined art of the longsword.', tags: ['combat', 'martial', 'longsword', 'melee'], category: 'Combat', status: 'done', nodes };
}

function pyromancyTree(): SkillTree {
  const nodes: SkillNode[] = [
    node({ id: 'py1', name: 'Spark of Mana', cost: 2, prerequisite: 'Attuned to an elemental focus.', description: 'Awaken your mana and conjure flame.',
      grants: [{ id: sid('g'), kind: 'resource', resourceId: 'mana', amount: 6 }],
      actions: [action({ name: 'Firebolt', cost: '1 Action', findingTags: ['fire'], ruleTags: ['spell', 'attack'], resource: { resourceId: 'mana', mode: 'consume', amount: 1 }, effect: 'On hit deal {{KNO + damage}} fire damage.' })] }),
    node({ id: 'py2', name: 'Attunement', prereqNodeIds: ['py1'], description: '+4 max mana.', grants: [{ id: sid('g'), kind: 'resource', resourceId: 'mana', amount: 4 }] }),
    node({ id: 'py3', name: 'The Fork', prereqNodeIds: ['py2'], exclusive: true, description: 'Choose one path: Hearth or Inferno.' }),
    node({ id: 'py4a', name: 'Warding Flame', prereqNodeIds: ['py3'], description: 'Hearth path.',
      actions: [action({ name: 'Warding Flame', cost: '1 Action', findingTags: ['fire'], ruleTags: ['spell', 'defence'], resource: { resourceId: 'mana', mode: 'consume', amount: 2 }, effect: 'Attackers take {{WIL + damage}} fire damage.' })] }),
    node({ id: 'py4b', name: 'Fireball', prereqNodeIds: ['py3'], cost: 3, description: 'Inferno path.',
      actions: [action({ name: 'Fireball', cost: '1 Action', findingTags: ['fire'], ruleTags: ['spell', 'aoe'], resource: { resourceId: 'mana', mode: 'consume', amount: 3 }, flavour: 'It detonates in a roiling sphere.', effect: 'A burst deals {{KNO + level + damage}} fire damage.' })] }),
  ];
  return { id: 'tree_pyromancy', name: 'Pyromancy', description: 'Spellcraft of living fire; forks into Hearth and Inferno (exclusive).', tags: ['magic', 'fire', 'spellcasting', 'combat'], category: 'Combat', status: 'done', nodes };
}

function silverTongueTree(): SkillTree {
  const nodes: SkillNode[] = [
    node({ id: 'st1', name: 'Read the Room', description: 'Sense surface motives.', actions: [action({ name: 'Read the Room', cost: '1 Action', ruleTags: ['social', 'utility'], effect: 'Learn the surface motives of those present.' })] }),
    node({ id: 'st2', name: 'Silver Words', prereqNodeIds: ['st1'], description: '+1 WIL.', grants: [{ id: sid('g'), kind: 'modifier', target: 'WIL', value: 1, mode: 'add' }] }),
  ];
  return { id: 'tree_silvertongue', name: 'Silver Tongue', description: 'Persuasion, deception, reading people.', tags: ['social', 'utility', 'passive'], category: 'Social', status: 'done', nodes };
}

// ── Resources / damage types / items ─────────────────────────────────────────
function seedResources(): ResourceDef[] {
  return [
    { id: 'mana', label: 'Mana', type: 'number', maxFormula: '0', colour: '#5aa6e0', shortRest: 0, longRest: 999, alwaysVisible: false },
    { id: 'res_secondwind', label: 'Second Wind', type: 'dots', maxFormula: '1', colour: '#e0b34a', shortRest: 1, longRest: 1, alwaysVisible: true },
    { id: 'res_focus', label: 'Focus', type: 'bar', maxFormula: '3', colour: '#5aa6e0', shortRest: 1, longRest: 3, alwaysVisible: true },
  ];
}

function seedDamageTypes(): DamageType[] {
  return [
    { id: 'dt_slash', name: 'Slashing', colour: '#d98a8a' },
    { id: 'dt_pierce', name: 'Piercing', colour: '#8ad9c0' },
    { id: 'dt_blunt', name: 'Bludgeoning', colour: '#c0b08a' },
    { id: 'dt_fire', name: 'Fire', colour: '#e0894a' },
  ];
}

function seedItems(): ItemDef[] {
  const item = (p: Partial<ItemDef> & { id: string; name: string }): ItemDef => ({
    id: p.id, name: p.name, description: p.description ?? '', level: p.level ?? 1, category: p.category ?? 'Gear',
    tags: p.tags ?? [], weight: p.weight ?? 1, flavour: p.flavour ?? '', grants: p.grants ?? [], actions: p.actions ?? [], weapon: p.weapon ?? null,
  });
  return [
    item({ id: 'item_leather', name: 'Leather Armour', category: 'Armour', level: 1, tags: ['armour', 'light'], weight: 10, grants: [{ id: sid('g'), kind: 'ac', low: '9 - floor(DEX / 4)', high: '13 + floor(DEX / 4)' }] }),
    item({ id: 'item_plate', name: 'Plate Armour', category: 'Armour', level: 5, tags: ['armour', 'heavy'], weight: 65, grants: [{ id: sid('g'), kind: 'ac', low: '6', high: '18' }] }),
    item({ id: 'item_longsword', name: 'Longsword', category: 'Weapon', level: 1, tags: ['weapon', 'longsword', 'martial'], weight: 3, flavour: 'A versatile blade.',
      weapon: { modes: [
        { id: sid('m'), name: 'Slash', attackType: 'slash', damage: [{ id: sid('d'), notation: '1d8', typeId: 'dt_slash' }], scaleToHit: 'STR', scaleDamage: 'STR', toHitBonus: 0 },
        { id: sid('m'), name: 'Thrust', attackType: 'thrust', damage: [{ id: sid('d'), notation: '1d6', typeId: 'dt_pierce' }], scaleToHit: 'DEX', scaleDamage: 'DEX', toHitBonus: 1 },
      ] } }),
    item({ id: 'item_dagger', name: 'Dagger', category: 'Weapon', level: 1, tags: ['weapon', 'finesse', 'piercing'], weight: 1,
      weapon: { modes: [{ id: sid('m'), name: 'Stab', attackType: 'thrust', damage: [{ id: sid('d'), notation: '1d4', typeId: 'dt_pierce' }], scaleToHit: 'DEX', scaleDamage: 'DEX', toHitBonus: 0 }] } }),
    item({ id: 'item_ring_sword', name: 'Ring of Sword Fighting', category: 'Accessory', level: 4, tags: ['ring', 'magic'], weight: 0, flavour: '+1 to sword attacks, +2 more on a thrust.',
      grants: [
        { id: sid('g'), kind: 'dmgbonus', weaponTag: 'longsword', attackName: '', attackType: '', toHitBonus: '', formula: '1', damageTypeId: 'dt_slash' },
        { id: sid('g'), kind: 'dmgbonus', weaponTag: '', attackName: '', attackType: 'thrust', toHitBonus: '', formula: '2', damageTypeId: 'dt_pierce' },
      ] }),
    item({ id: 'item_ring_str', name: 'Ring of the Bull', category: 'Accessory', level: 3, tags: ['ring', 'magic'], weight: 0, flavour: 'Grants +2 Strength while worn.', grants: [{ id: sid('g'), kind: 'modifier', target: 'STR', value: 2, mode: 'add' }] }),
    item({ id: 'item_torch', name: 'Torch', category: 'Gear', level: 1, tags: ['gear'], weight: 1, description: 'Sheds light.' }),
  ];
}

function seedRuleTags(): RuleTagDef[] {
  return [
    { tag: 'attack', description: 'An action that makes a weapon or spell attack roll.' },
    { tag: 'martial', description: 'A non-magical, physical technique.' },
    { tag: 'spell', description: 'A magical effect.' },
    { tag: 'reaction', description: 'Used outside your turn in response to a trigger.' },
    { tag: 'aoe', description: 'Affects an area, hitting multiple targets.' },
    { tag: 'defence', description: 'Primarily protective.' },
    { tag: 'social', description: 'Used to influence others.' },
    { tag: 'utility', description: 'Non-combat or general-purpose.' },
    { tag: 'finesse', description: 'May use Dexterity instead of Strength.' },
  ];
}

const GLOBAL_TAGS = ['combat', 'social', 'exploration', 'martial', 'spellcasting', 'magic', 'fire', 'longsword', 'melee', 'attack', 'spell', 'reaction', 'aoe', 'defence', 'utility', 'passive', 'finesse', 'armour', 'weapon', 'ring', 'gear', 'light', 'heavy', 'piercing'];

export function defaultRuleset(): Ruleset {
  counter = 0;
  return {
    schema: RULESET_SCHEMA,
    version: 1,
    name: 'Veilbound Core Rules',
    password: 'gm',
    levelTable: buildLevelTable(),
    formulas: { prof: 'floor(level / 4) + 2', hpMax: '10 + level * 2 + STR * 3 + prof', soulMax: 'soul' },
    hpShortRest: 5,
    hpLongRest: 999,
    unarmoredACLow: '',
    unarmoredACHigh: '',
    resources: seedResources(),
    trees: [longswordTree(), pyromancyTree(), silverTongueTree()],
    items: seedItems(),
    ruleTags: seedRuleTags(),
    damageTypes: seedDamageTypes(),
    tags: GLOBAL_TAGS,
    categories: ['Combat', 'Social', 'Exploration'],
    itemCategories: ['Weapon', 'Armour', 'Accessory', 'Gear'],
    toHitFormula: 'prof + scale',
  };
}

// ── Character factory ────────────────────────────────────────────────────────
export function defaultBags(): Bag[] {
  return [
    { id: 'bag_worn', name: 'Worn', column: 0 },
    { id: 'bag_backpack', name: 'Backpack', column: 1 },
  ];
}

export function newCharacter(name: string, ruleset: Ruleset, statTiers?: Record<CoreStat, Tier>): Character {
  const resourceState: Record<string, number> = {};
  for (const r of ruleset.resources) resourceState[r.id] = 0;
  return {
    id: uid('char'),
    name: name.trim() || 'New Character',
    level: 1,
    crit: 0,
    statTiers: statTiers ?? { STR: 'pri', DEX: 'sec', KNO: 'tert', WIL: 'quat' },
    hpCurrent: 0,
    soulCurrent: 0,
    grantedSkillPoints: 0,
    modifiers: [],
    resourceState,
    trees: {},
    inventory: [],
    bags: defaultBags(),
    actionTabs: [{ id: uid('tab'), name: 'All', tags: [], names: [], categories: [], matchMode: 'any', showDescriptions: true, defaultInclude: true, layout: 'list', columnSize: 1, columns: [], costOrder: [], unsortedLabel: 'Unsorted', hideUnsorted: false, children: [] }],
    skillTabs: [{ id: uid('stab'), name: 'All', treeIds: [], defaultInclude: true, nameFilters: [], tagFilters: [] }],
    sheetSkillTabs: [],
    seenRulesetVersion: ruleset.version,
  };
}
