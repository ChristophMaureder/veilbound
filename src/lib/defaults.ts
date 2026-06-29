// ──────────────────────────────────────────────────────────────────────────
// Seed ruleset + character factory — Revision 3.
//
// The level-up table starts EMPTY (§11.2) — the GM fills it. Everything else is
// seeded richly: free-form trees with grants/actions, damage types, items
// (armour / weapon with use-modes / ring with grant modes), and mana-as-resource.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ActionModifier,
  Bag,
  Character,
  CoreStat,
  DamageType,
  Grant,
  ItemDef,
  LevelRow,
  Preset,
  TreeProgressionCosts,
  TreeRequirement,
  ResourceDef,
  RuleTagDef,
  Ruleset,
  SkillAction,
  SkillNode,
  SkillTree,
  Tier,
} from './types';
import { uid } from './util';
import rulesetSeed from './ImportedRules/rulesetSeed.json';

// All JSON files under ImportedRules/SkillTrees/ are auto-imported as skill trees.
const _treeModules = import.meta.glob('./ImportedRules/SkillTrees/*.json', { eager: true }) as Record<string, { default: unknown }>;
const IMPORTED_SKILL_TREES: SkillTree[] = Object.values(_treeModules)
  .map((m) => m.default as unknown as SkillTree)
  .filter((t): t is SkillTree => !!(t && typeof t === 'object' && (t as SkillTree).id && Array.isArray((t as SkillTree).nodes)));

// Trees defined in rulesetSeed.json are also authoritative for any ID not covered by a SkillTrees/ JSON.
const _seedObj = rulesetSeed as unknown as { trees?: unknown[] };
const SEED_TREES: SkillTree[] = Array.isArray(_seedObj?.trees)
  ? (_seedObj.trees as unknown[]).filter((t): t is SkillTree => !!(t && typeof t === 'object' && (t as SkillTree).id && Array.isArray((t as SkillTree).nodes)))
  : [];

export const STORAGE_KEYS = {
  ruleset: 'veilbound.ruleset.v3',
  characters: 'veilbound.characters.v3',
  active: 'veilbound.activeCharacter.v3',
  treeEditorUi: 'veilbound.treeEditorUi.v1',
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
    showWeaponInfo: p.showWeaponInfo,
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
    node({ id: 'ls4', name: 'Finesse Forms', prereqNodeIds: ['ls3'], description: 'All longsword attacks may scale off Dexterity.', grants: [{ id: sid('g'), kind: 'scaling', tag: 'longsword', attackTag: '', toHit: 'DEX', damage: 'DEX' }] }),
    node({ id: 'ls5', name: 'Riposte', prereqNodeIds: ['ls3'], cost: 3, description: 'Punish a miss.',
      actions: [action({ name: 'Riposte', cost: 'Reaction', findingTags: ['longsword'], ruleTags: ['reaction', 'martial'], effect: 'When an attacker misses you, strike for {{STR + damage}} damage.' })] }),
    node({ id: 'ls6', name: 'Whirlwind', prereqNodeIds: ['ls4', 'ls5'], cost: 4, description: 'Sweep all adjacent foes (reachable from either path).',
      actions: [action({ name: 'Whirlwind', cost: '2 Actions', findingTags: ['longsword'], ruleTags: ['attack', 'aoe'], effect: 'Hit every adjacent creature for {{STR + damage}} damage.' })] }),
    node({ id: 'ls7', name: 'Bladestorm', prereqNodeIds: ['ls6'], cost: 4, hideDescription: true, description: 'Secret technique.' }),
    node({ id: 'ls8', name: 'Perfect Form', prereqNodeIds: ['ls7'], cost: 5, hideName: true, hideDescription: true, description: 'Your crits devastate.', grants: [{ id: sid('g'), kind: 'modifier', target: 'hpMax', value: 10, mode: 'add' }] }),
  ];
  return { id: 'tree_longsword', name: 'Longsword Mastery', description: 'The disciplined art of the longsword.', tags: ['combat', 'martial', 'longsword', 'melee'], category: 'Combat', subcategory: 'Melee', status: 'done', treeType: 'skill' as const, rarity: 'expert' as const, nodes };
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
  return { id: 'tree_pyromancy', name: 'Pyromancy', description: 'Spellcraft of living fire; forks into Hearth and Inferno (exclusive).', tags: ['magic', 'fire', 'spellcasting', 'combat'], category: 'Magic', subcategory: 'Fire', status: 'done', treeType: 'spell' as const, rarity: 'expert' as const, nodes };
}

function silverTongueTree(): SkillTree {
  const nodes: SkillNode[] = [
    node({ id: 'st1', name: 'Read the Room', description: 'Sense surface motives.', actions: [action({ name: 'Read the Room', cost: '1 Action', ruleTags: ['social', 'utility'], effect: 'Learn the surface motives of those present.' })] }),
    node({ id: 'st2', name: 'Silver Words', prereqNodeIds: ['st1'], description: '+1 WIL.', grants: [{ id: sid('g'), kind: 'modifier', target: 'WIL', value: 1, mode: 'add' }] }),
  ];
  return { id: 'tree_silvertongue', name: 'Silver Tongue', description: 'Persuasion, deception, reading people.', tags: ['social', 'utility', 'passive'], category: 'Social', subcategory: 'Manipulation', status: 'done', treeType: 'skill' as const, rarity: 'basic' as const, nodes };
}

/**
 * Build a linear "level" chain (a tree's level = owned-node count). Actions land
 * only on the 1st, 5th, 10th, and 15th node; other nodes are stepping stones
 * with the occasional +1 stat bump.
 */
function linearTree(opts: {
  id: string; name: string; description: string; tags: string[];
  category: string; subcategory?: string; requirements?: TreeRequirement[];
  treeType?: 'skill' | 'spell'; rarity?: 'basic' | 'expert' | 'legendary';
  actionAt: Record<number, SkillAction>;
  statAt?: Record<number, CoreStat>;
  count?: number;
}): SkillTree {
  const count = opts.count ?? 15;
  const nodes: SkillNode[] = [];
  let prev: string | null = null;
  for (let i = 1; i <= count; i++) {
    const id = `${opts.id}_n${i}`;
    const grants: Grant[] = [];
    const st = opts.statAt?.[i];
    if (st) grants.push({ id: sid('g'), kind: 'modifier', target: st, value: 1, mode: 'add' });
    const act = opts.actionAt[i];
    nodes.push(node({
      id,
      name: act ? act.name : `${opts.name} ${i}`,
      cost: i === 1 ? 1 : 2,
      description: act ? '' : 'Continued training.',
      prereqNodeIds: prev ? [prev] : [],
      actions: act ? [act] : [],
      grants,
    }));
    prev = id;
  }
  return { id: opts.id, name: opts.name, description: opts.description, tags: opts.tags, category: opts.category, subcategory: opts.subcategory, status: 'done', treeType: opts.treeType ?? 'skill', rarity: opts.rarity ?? 'basic', nodes, requirements: opts.requirements };
}

function extraTrees(): SkillTree[] {
  const greatsword = linearTree({
    id: 'tree_greatsword', name: 'Greatsword Forms', description: 'Two-handed power techniques.',
    tags: ['combat', 'martial', 'melee'], category: 'Combat', subcategory: 'Melee', rarity: 'expert',
    statAt: { 3: 'STR', 8: 'STR', 13: 'STR' },
    actionAt: {
      1: action({ name: 'Cleave', findingTags: ['greatsword'], ruleTags: ['attack', 'martial'], effect: 'Strike for {{STR * 2 + damage}} damage.' }),
      5: action({ name: 'Sunder', findingTags: ['greatsword'], ruleTags: ['attack', 'martial'], effect: 'Break armour; deal {{STR * 2 + level + damage}} damage.' }),
      10: action({ name: 'Earthshaker', cost: '2 Actions', findingTags: ['greatsword'], ruleTags: ['attack', 'aoe'], effect: 'Hit all adjacent for {{STR * 2 + level + damage}} damage.' }),
      15: action({ name: 'Executioner', cost: '2 Actions', findingTags: ['greatsword'], ruleTags: ['attack', 'martial'], effect: 'Massive blow for {{STR * 3 + level * 2 + damage}} damage.' }),
    },
  });
  const spear = linearTree({
    id: 'tree_spear', name: 'Spear Forms', description: 'Reach and control with the spear.',
    tags: ['combat', 'martial', 'melee'], category: 'Combat', subcategory: 'Melee',
    statAt: { 3: 'DEX', 8: 'STR', 13: 'DEX' },
    actionAt: {
      1: action({ name: 'Lunge', findingTags: ['spear'], ruleTags: ['attack', 'martial'], effect: 'Reach strike for {{DEX + STR + damage}} damage.' }),
      5: action({ name: 'Phalanx', cost: 'Reaction', findingTags: ['spear'], ruleTags: ['reaction', 'defence'], effect: 'Brace; punish a charger for {{STR + damage}} damage.' }),
      10: action({ name: 'Whirl', cost: '2 Actions', findingTags: ['spear'], ruleTags: ['attack', 'aoe'], effect: 'Sweep all in reach for {{DEX + damage}} damage.' }),
      15: action({ name: 'Skewer', cost: '2 Actions', findingTags: ['spear'], ruleTags: ['attack', 'martial'], effect: 'Impale for {{DEX * 2 + level * 2 + damage}} damage.' }),
    },
  });
  const marksman = linearTree({
    id: 'tree_marksman', name: 'Marksmanship', description: 'Precision at range — demands a steady hand.',
    tags: ['combat', 'martial', 'ranged'], category: 'Combat', subcategory: 'Ranged',
    requirements: [{ id: sid('req'), kind: 'stat', stat: 'DEX', min: 12 }],
    statAt: { 3: 'DEX', 8: 'DEX', 13: 'DEX' },
    actionAt: {
      1: action({ name: 'Aimed Shot', findingTags: ['bow'], ruleTags: ['attack'], effect: 'Careful shot for {{DEX * 2 + damage}} damage.' }),
      5: action({ name: 'Pinning Shot', findingTags: ['bow'], ruleTags: ['attack'], effect: 'Pin a target; {{DEX + level + damage}} damage and slow.' }),
      10: action({ name: 'Volley', cost: '2 Actions', findingTags: ['bow'], ruleTags: ['attack', 'aoe'], effect: 'Rain arrows on an area for {{DEX + level + damage}} damage.' }),
      15: action({ name: 'Hawkeye', findingTags: ['bow'], ruleTags: ['attack'], effect: 'Impossible shot for {{DEX * 3 + level * 2 + damage}} damage.' }),
    },
  });
  const frost = linearTree({
    id: 'tree_frost', name: 'Frostweaving', description: 'Ice magic, unlocked once flame is mastered.',
    tags: ['magic', 'frost', 'spellcasting'], category: 'Magic', subcategory: 'Frost', treeType: 'spell', rarity: 'expert',
    requirements: [{ id: sid('req'), kind: 'treeLevel', treeId: 'tree_pyromancy', min: 5 }],
    statAt: { 3: 'KNO', 8: 'KNO', 13: 'WIL' },
    actionAt: {
      1: action({ name: 'Frost Bolt', findingTags: ['ice'], ruleTags: ['spell', 'attack'], resource: { resourceId: 'mana', mode: 'consume', amount: 1 }, effect: 'Deal {{KNO + damage}} cold damage and slow.' }),
      5: action({ name: 'Ice Armour', findingTags: ['ice'], ruleTags: ['spell', 'defence'], resource: { resourceId: 'mana', mode: 'consume', amount: 2 }, effect: 'Sheathe in ice; gain temporary armour.' }),
      10: action({ name: 'Blizzard', cost: '2 Actions', findingTags: ['ice'], ruleTags: ['spell', 'aoe'], resource: { resourceId: 'mana', mode: 'consume', amount: 3 }, effect: 'A storm deals {{KNO + level + damage}} cold damage in an area.' }),
      15: action({ name: 'Absolute Zero', cost: '2 Actions', findingTags: ['ice'], ruleTags: ['spell'], resource: { resourceId: 'mana', mode: 'consume', amount: 5 }, effect: 'Freeze solid for {{KNO * 2 + level * 2 + damage}} cold damage.' }),
    },
  });
  const weaponMaster = linearTree({
    id: 'tree_weaponmaster', name: 'Weapon Master', description: 'Mastery that spans melee disciplines.',
    tags: ['combat', 'martial', 'melee'], category: 'Combat', subcategory: 'Melee', rarity: 'legendary',
    requirements: [
      { id: sid('req'), kind: 'subcatLevel', subcategory: 'Melee', level: 3, count: 2 },
      { id: sid('req'), kind: 'stat', stat: 'STR', min: 14 },
    ],
    statAt: { 3: 'STR', 8: 'STR', 13: 'STR' },
    actionAt: {
      1: action({ name: 'Perfect Guard', cost: 'Reaction', ruleTags: ['reaction', 'defence'], effect: 'Negate one incoming hit.' }),
      5: action({ name: 'Flurry', cost: '2 Actions', ruleTags: ['attack', 'martial'], effect: 'Three strikes for {{STR + damage}} each.' }),
      10: action({ name: 'Disarm', ruleTags: ['attack', 'martial'], effect: 'Knock a weapon away; {{STR + damage}} damage.' }),
      15: action({ name: 'Grand Master', cost: '2 Actions', ruleTags: ['attack', 'martial'], effect: 'Legendary blow for {{STR * 3 + level * 2 + damage}} damage.' }),
    },
  });
  const wild = linearTree({
    id: 'tree_wild', name: 'Wilderness Lore', description: 'Survival, tracking, and foraging.',
    tags: ['exploration', 'survival', 'utility'], category: 'Survival', subcategory: 'Wild',
    statAt: { 3: 'WIL', 8: 'KNO', 13: 'WIL' },
    actionAt: {
      1: action({ name: 'Forage', ruleTags: ['utility'], effect: 'Find food and water in the wild.' }),
      5: action({ name: 'Track', ruleTags: ['utility'], effect: 'Follow a creature’s trail across terrain.' }),
      10: action({ name: 'Camouflage', ruleTags: ['utility', 'defence'], effect: 'Blend into terrain; advantage to hide.' }),
      15: action({ name: 'One With Nature', ruleTags: ['utility'], effect: 'Commune with the wild for guidance.' }),
    },
  });
  return [greatsword, spear, marksman, frost, weaponMaster, wild];
}

// ── Resources / damage types / items ─────────────────────────────────────────
function seedResources(): ResourceDef[] {
  return [
    { id: 'mana', label: 'Mana', type: 'number', maxFormula: '0', colour: '#5aa6e0', shortRest: 0, longRest: 999, alwaysVisible: false },
    { id: 'res_secondwind', label: 'Second Wind', type: 'dots', maxFormula: '1', colour: '#e0b34a', shortRest: 1, longRest: 1, alwaysVisible: true },
    { id: 'res_focus', label: 'Focus', type: 'bar', maxFormula: '3', colour: '#5aa6e0', shortRest: 1, longRest: 3, alwaysVisible: true },
    { id: 'aim', label: 'Aim', type: 'dots', maxFormula: '0', colour: '#c8a44a', shortRest: 0, longRest: 0, alwaysVisible: false },
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
    tags: p.tags ?? [], weight: p.weight ?? 1, flavour: p.flavour ?? '', grants: p.grants ?? [], actions: p.actions ?? [], weapon: p.weapon ?? null, shield: p.shield ?? null,
  });
  return [
    item({ id: 'item_leather', name: 'Leather Armour', category: 'Armour', level: 1, tags: ['armour', 'light'], weight: 10, grants: [{ id: sid('g'), kind: 'ac', low: '9 - floor(DEX / 4)', high: '13 + floor(DEX / 4)' }] }),
    item({ id: 'item_plate', name: 'Plate Armour', category: 'Armour', level: 5, tags: ['armour', 'heavy'], weight: 65, grants: [{ id: sid('g'), kind: 'ac', low: '6', high: '18' }] }),
    item({ id: 'item_longsword', name: 'Longsword', category: 'Weapon', level: 1, tags: ['weapon', 'longsword', 'martial'], weight: 3, flavour: 'A versatile blade.',
      grants: [{ id: sid('g'), kind: 'resource', resourceId: 'aim', amount: 4 }],
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

// ── Standard actions & presets ───────────────────────────────────────────────
/** Global actions every character owns (basic combat options). */
function seedStandardActions(): SkillAction[] {
  const sa = (id: string, name: string, cost: string, ruleTags: string[], effect: string): SkillAction => ({
    id, name, cost, findingTags: [], ruleTags, flavour: '', effect, resources: [], weaponTarget: '', weaponMode: '',
  });
  return [
    // ── Weapon attacks ──────────────────────────────────────────────────────────
    { id: 'std_lightattack', name: 'Light Attack', cost: '1 Action', findingTags: [], ruleTags: ['attack', 'martial'], flavour: '', effect: '', resources: [], weaponTarget: 'main', weaponMode: '', showWeaponInfo: true },
    { id: 'std_heavyattack', name: 'Heavy Attack', cost: '1 Action', findingTags: [], ruleTags: ['attack', 'martial'], flavour: '', effect: 'Strike with full force. Deal {{aim * main}}.', resources: [{ resourceId: 'res_focus', mode: 'consume', amount: 1 }], weaponTarget: 'main', weaponMode: '', showWeaponInfo: false },
    { id: 'std_takeaim', name: 'Take Aim', cost: '1 Action', findingTags: [], ruleTags: ['utility'], flavour: '', effect: 'Steady your focus for a devastating strike. Works with any physical weapon — melee or ranged.', resources: [{ resourceId: 'aim', mode: 'grant', amount: 1 }], weaponTarget: '', weaponMode: '' },
    // ── Movement & utility ──────────────────────────────────────────────────────
    sa('std_dash', 'Dash', '1 Action', ['utility'], 'Double your movement speed this turn.'),
    sa('std_dodge', 'Dodge', '1 Action', ['defence'], 'Attacks against you have disadvantage until your next turn.'),
    sa('std_disengage', 'Disengage', '1 Action', ['utility'], 'Your movement no longer provokes reactions this turn.'),
    sa('std_help', 'Help', '1 Action', ['social', 'utility'], 'Aid an ally; their next roll gains advantage.'),
    sa('std_hide', 'Hide', '1 Action', ['utility'], 'Attempt to conceal yourself from enemies.'),
    sa('std_shove', 'Shove', '1 Action', ['martial'], 'Push a creature within reach or knock it prone.'),
    sa('std_ready', 'Ready', '1 Action', ['reaction'], 'Prepare an action to trigger on a condition you set.'),
  ];
}

/** Global attack modifiers players can toggle onto matching action cards. */
function seedModifiers(): ActionModifier[] {
  return [
    { id: 'mod_dash', name: 'Dash Attack', targetMode: 'tags', actionTags: ['attack'], spellNames: [], attackType: '', attackDamage: '', attackToHit: '', addRuleTags: ['defenseless'], effect: 'Move up to your speed, then make this attack — but you are defenseless until your next turn.', flavour: '', resource: null },
    { id: 'mod_determined', name: 'Determined Attack', targetMode: 'tags', actionTags: ['attack'], spellNames: [], attackType: '', attackDamage: '', attackToHit: '2', addRuleTags: [], effect: 'Attack with grim focus: +2 to hit.', flavour: '', resource: null },
  ];
}



/** GM-authored starting points the player can apply whole or per-section. */
function seedPresets(): Preset[] {
  return [
    {
      id: 'preset_sword', name: 'Sword Fighter',
      description: 'A frontline melee combatant. Starts with martial standard actions and longsword skills.',
      statTiers: { STR: 'pri', DEX: 'sec', WIL: 'tert', KNO: 'quat' },
      standardActionIds: ['std_lightattack', 'std_heavyattack', 'std_takeaim', 'std_dash', 'std_dodge', 'std_disengage', 'std_shove'],
      skillTabs: [
        { id: 'stab_sword_melee', name: 'Melee', treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: ['Melee'], columns: [] },
        { id: 'stab_sword_combat', name: 'Combat', treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: ['Combat'], columns: [] },
      ],
    },
    {
      id: 'preset_firemage', name: 'Fire Mage',
      description: 'A spellcaster wielding flame. Starts with pyromancy skills and caster standard actions.',
      statTiers: { KNO: 'pri', WIL: 'sec', DEX: 'tert', STR: 'quat' },
      standardActionIds: ['std_lightattack', 'std_dash', 'std_dodge', 'std_ready', 'std_help'],
      skillTabs: [
        { id: 'stab_mage_magic', name: 'Magic', treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: ['Magic'], columns: [] },
        { id: 'stab_mage_fire', name: 'Fire', treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: ['Fire'], columns: [] },
      ],
    },
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
    { tag: 'defenseless', description: 'You cannot use any actions with the defence tag until the start of your next turn.' },
  ];
}

const GLOBAL_TAGS = ['combat', 'social', 'exploration', 'survival', 'martial', 'spellcasting', 'magic', 'fire', 'frost', 'ice', 'longsword', 'greatsword', 'spear', 'bow', 'ranged', 'melee', 'attack', 'spell', 'reaction', 'aoe', 'defence', 'utility', 'passive', 'finesse', 'armour', 'weapon', 'ring', 'gear', 'light', 'heavy', 'piercing'];

export function mergeImportedTrees(base: Ruleset): Ruleset {
  // SkillTrees/*.json files always replace stored versions with the same id.
  const importedIds = new Set(IMPORTED_SKILL_TREES.map((t) => t.id));
  let trees = base.trees.filter((t) => !importedIds.has(t.id));
  trees = [...trees, ...IMPORTED_SKILL_TREES];

  // rulesetSeed.json trees are also authoritative for ids not covered by a JSON file.
  const seedAuthIds = new Set(SEED_TREES.filter((t) => !importedIds.has(t.id)).map((t) => t.id));
  trees = trees.filter((t) => !seedAuthIds.has(t.id));
  trees = [...trees, ...SEED_TREES.filter((t) => seedAuthIds.has(t.id))];

  return { ...base, trees };
}

export function defaultRuleset(): Ruleset {
  if (rulesetSeed && typeof rulesetSeed === 'object') {
    const seed = rulesetSeed as unknown as Ruleset;
    counter = 0;
    return mergeImportedTrees({
      ...seed,
      standardActions: seed.standardActions ?? seedStandardActions(),
      modifiers: seed.modifiers ?? seedModifiers(),
      treeProgressionCosts: seed.treeProgressionCosts,
      presets: seed.presets ?? seedPresets(),
      ruleTags: seed.ruleTags ?? seedRuleTags(),
      damageTypes: seed.damageTypes ?? seedDamageTypes(),
      resources: seed.resources ?? seedResources(),
      items: seed.items ?? seedItems(),
    });
  }
  counter = 0;
  const base: Ruleset = {
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
    trees: [longswordTree(), pyromancyTree(), silverTongueTree(), ...extraTrees()],
    items: seedItems(),
    standardActions: seedStandardActions(),
    modifiers: seedModifiers(),
    treeProgressionCosts: (rulesetSeed as unknown as { treeProgressionCosts?: TreeProgressionCosts }).treeProgressionCosts!,
    presets: seedPresets(),
    ruleTags: seedRuleTags(),
    damageTypes: seedDamageTypes(),
    tags: GLOBAL_TAGS,
    categories: ['Combat', 'Social', 'Exploration', 'Magic', 'Survival'],
    itemCategories: ['Weapon', 'Armour', 'Accessory', 'Gear'],
    toHitFormula: 'prof + scale',
  };
  return mergeImportedTrees(base);
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
    actionTabs: defaultActionTabs(),
    skillTabs: [],
    sheetSkillTabs: [],
    hiddenStandardActionIds: [],
    seenRulesetVersion: ruleset.version,
  };
}

/** The two built-in action tabs every character starts with: All + Standard. */
export function defaultActionTabs(): import('./types').ActionTab[] {
  const base = () => ({ tags: [], names: [], categories: [], matchMode: 'any' as const, showDescriptions: true, layout: 'list' as const, columnSize: 1, columns: [], costOrder: [], unsortedLabel: 'Unsorted', hideUnsorted: false, children: [] });
  return [
    { id: uid('tab'), name: 'All', kind: 'all', hidden: false, defaultInclude: true, ...base() },
    { id: uid('tab'), name: 'Standard', kind: 'standard', hidden: false, defaultInclude: false, ...base() },
  ];
}
