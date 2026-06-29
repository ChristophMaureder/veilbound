// ──────────────────────────────────────────────────────────────────────────
// Application state — Revision 2. All player/ruleset data persists to
// localStorage; GM mode, current view and the open tree are session-only.
// ──────────────────────────────────────────────────────────────────────────

import { writable, derived, get } from 'svelte/store';
import type { ActionModifier, ActionTab, Bag, Character, CoreStat, Ruleset, SkillAction, SkillTab, Tier } from './types';
import { deriveCharacter, type Derived } from './engine/derive';
import { defaultActionTabs, defaultRuleset, mergeImportedTrees, newCharacter, STORAGE_KEYS } from './defaults';
import { clamp, clone, uid } from './util';

// ── Backfill migrations for data saved before newer fields existed ───────────
const LEGACY_MODIFIER_NAMES = new Set(['dash attack', 'determined attack']);
function migrateSkillAction(a: SkillAction): SkillAction {
  const raw = a as unknown as Record<string, unknown>;
  if (Array.isArray(raw.resources)) return a;
  const legacy = raw.resource as import('./types').ActionResourceUse | null | undefined;
  return { ...a, resources: legacy ? [legacy] : [] };
}
function actionToModifier(a: SkillAction): ActionModifier {
  return {
    id: uid('mod'),
    name: a.name,
    targetMode: 'tags',
    actionTags: ['attack'],
    spellNames: [],
    attackType: '',
    attackDamage: '',
    attackToHit: '',
    addRuleTags: a.ruleTags.filter((t) => t !== 'attack' && t !== 'martial'),
    effect: a.effect,
    flavour: a.flavour,
    resource: a.resources?.[0] ?? null,
  };
}
function migrateRuleset(r: Ruleset): Ruleset {
  const seed = defaultRuleset();
  let standardActions = r.standardActions ?? seed.standardActions;
  // Add any standard actions present in the seed but missing from stored ruleset.
  const storedSaIds = new Set(standardActions.map((a) => a.id));
  const missing = (seed.standardActions ?? []).filter((a) => !storedSaIds.has(a.id));
  if (missing.length) standardActions = [...standardActions, ...missing];
  let modifiers = r.modifiers ?? [];

  // Convert legacy Dash/Determined standard actions into attack modifiers (one-time).
  const legacy = standardActions.filter((a) => LEGACY_MODIFIER_NAMES.has(a.name.trim().toLowerCase()));
  if (legacy.length) {
    standardActions = standardActions.filter((a) => !LEGACY_MODIFIER_NAMES.has(a.name.trim().toLowerCase()));
    for (const a of legacy) {
      if (modifiers.some((m) => m.name.trim().toLowerCase() === a.name.trim().toLowerCase())) continue;
      modifiers = [...modifiers, actionToModifier(a)];
    }
  }
  if (modifiers.length === 0) modifiers = seed.modifiers ?? [];

  // Normalise legacy actionTag: string → targetMode / actionTags / spellNames
  modifiers = modifiers.map((m) => {
    const raw = m as unknown as Record<string, unknown>;
    return {
      ...m,
      targetMode: (raw.targetMode === 'tags' || raw.targetMode === 'spells') ? raw.targetMode : 'tags',
      actionTags: Array.isArray(raw.actionTags) ? (raw.actionTags as string[]) : (typeof raw.actionTag === 'string' && raw.actionTag ? [raw.actionTag] : ['attack']),
      spellNames: Array.isArray(raw.spellNames) ? (raw.spellNames as string[]) : [],
    } as ActionModifier;
  });

  return mergeImportedTrees({
    ...r,
    standardActions: standardActions.map(migrateSkillAction),
    modifiers,
    presets: r.presets ?? seed.presets,
    treeProgressionCosts: seed.treeProgressionCosts,
    trees: r.trees?.map((t) => ({
      ...t,
      treeType: t.treeType ?? 'skill',
      rarity: t.rarity ?? 'basic',
      nodes: t.nodes?.map((n) => ({ ...n, actions: n.actions?.map(migrateSkillAction) ?? [] })) ?? [],
    })) ?? r.trees,
    items: r.items?.map((i) => ({ ...i, actions: i.actions?.map(migrateSkillAction) ?? [] })) ?? r.items,
  });
}
function migrateCharacter(c: Character): Character {
  let actionTabs = c.actionTabs ?? [];
  if (!actionTabs.some((t) => t.kind === 'all')) {
    actionTabs = actionTabs.map((t, i) => (i === 0 ? { ...t, kind: 'all' as const } : t));
  }
  if (!actionTabs.some((t) => t.kind === 'standard')) {
    const std = defaultActionTabs().find((t) => t.kind === 'standard')!;
    actionTabs = [...actionTabs, std];
  }
  // Strip the auto-generated "All" skill tab (defaultInclude:true) — the browser's
  // "All Skills" button is the dedicated all-skills view now.
  const skillTabs = (c.skillTabs ?? []).filter((t) => !(t.defaultInclude && t.treeIds.length === 0 && (t.nameFilters ?? []).length === 0 && (t.tagFilters ?? []).length === 0 && (t.categoryFilters ?? []).length === 0));
  return { ...c, actionTabs, skillTabs, hiddenStandardActionIds: c.hiddenStandardActionIds ?? [] };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

const initialRuleset = migrateRuleset(load<Ruleset>(STORAGE_KEYS.ruleset, defaultRuleset()));
export const ruleset = writable<Ruleset>(initialRuleset);

const initialCharacters = load<Character[]>(STORAGE_KEYS.characters, []).map(migrateCharacter);
export const characters = writable<Character[]>(initialCharacters);

const initialActive = load<string | null>(STORAGE_KEYS.active, initialCharacters[0]?.id ?? null);
export const activeId = writable<string | null>(initialActive);

export type ViewName = 'sheet' | 'browser' | 'inventory' | 'admin';
export const view = writable<ViewName>('sheet');
export const gmMode = writable<boolean>(false);
export const forceReveal = writable<boolean>(false);
export const openTreeId = writable<string | null>(null);
export function openTree(id: string): void {
  openTreeId.set(id);
}

ruleset.subscribe((r) => save(STORAGE_KEYS.ruleset, r));
characters.subscribe((c) => save(STORAGE_KEYS.characters, c));
activeId.subscribe((id) => save(STORAGE_KEYS.active, id));

export interface TreeEditorUiState { selectedTreeId: string | null; nodeMemory: Record<string, string>; }
const initialTreeEditorUi = load<TreeEditorUiState>(STORAGE_KEYS.treeEditorUi, { selectedTreeId: null, nodeMemory: {} });
export const treeEditorUi = writable<TreeEditorUiState>(initialTreeEditorUi);
treeEditorUi.subscribe((s) => save(STORAGE_KEYS.treeEditorUi, s));

// Session-only UI state (not persisted to localStorage)
export const skillCardPanelOpen = writable<Record<string, { req: boolean; prereq: boolean }>>({});

export const activeCharacter = derived(
  [characters, activeId],
  ([$chars, $id]) => $chars.find((c) => c.id === $id) ?? null,
);
export const derivedActive = derived(
  [activeCharacter, ruleset],
  ([$char, $rules]): Derived | null => ($char ? deriveCharacter($char, $rules) : null),
);
export const rulesetChanged = derived(
  [activeCharacter, ruleset],
  ([$char, $rules]) => !!$char && $char.seenRulesetVersion < $rules.version,
);

// ── Character mutations ──────────────────────────────────────────────────────
export function normalizeCharacter(char: Character, rules: Ruleset): Character {
  const d = deriveCharacter(char, rules);
  const resourceState = { ...char.resourceState };
  for (const r of d.resources) {
    resourceState[r.def.id] = clamp(resourceState[r.def.id] ?? 0, 0, r.max);
  }
  return {
    ...char,
    hpCurrent: clamp(char.hpCurrent, 0, d.hpMax.effective),
    soulCurrent: clamp(char.soulCurrent, 0, d.soulMax.effective),
    crit: clamp(char.crit, -6, 6),
    resourceState,
    hiddenStandardActionIds: char.hiddenStandardActionIds ?? [],
  };
}

export function updateCharacter(id: string, updater: (c: Character) => Character): void {
  const rules = get(ruleset);
  characters.update(($chars) =>
    $chars.map((c) => (c.id === id ? normalizeCharacter(updater(clone(c)), rules) : c)),
  );
}
export function updateActive(updater: (c: Character) => Character): void {
  const id = get(activeId);
  if (id) updateCharacter(id, updater);
}
export function updateTreeProgress(
  treeId: string,
  updater: (p: import('./types').TreeProgress) => import('./types').TreeProgress,
): void {
  updateActive((c) => {
    const prev = c.trees[treeId] ?? { prereqMet: {}, invested: {} };
    return { ...c, trees: { ...c.trees, [treeId]: updater(prev) } };
  });
}

/** Spend (negative) or restore (positive) a resource from an action's Use button. */
export function adjustResource(id: string, delta: number): void {
  updateActive((c) => {
    const d = deriveCharacter(c, get(ruleset));
    const max = d.resourceById[id]?.max ?? 0;
    const cur = clamp(c.resourceState[id] ?? 0, 0, max);
    return { ...c, resourceState: { ...c.resourceState, [id]: clamp(cur + delta, 0, max) } };
  });
}

/** Toggle whether a standard action is hidden for the active character. */
export function toggleHiddenStandardAction(id: string): void {
  updateActive((c) => {
    const set = new Set(c.hiddenStandardActionIds ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    return { ...c, hiddenStandardActionIds: [...set] };
  });
}

export function grantSkillPoints(amount: number): void {
  updateActive((c) => ({ ...c, grantedSkillPoints: Math.max(0, c.grantedSkillPoints + Math.round(amount)) }));
}

// ── Presets ──────────────────────────────────────────────────────────────────
export type PresetSection = 'stats' | 'standard' | 'actionTabs' | 'skillTabs';

function freshActionTab(t: ActionTab): ActionTab {
  return { ...clone(t), id: uid('tab'), kind: 'normal', hidden: false, children: (t.children ?? []).map(freshActionTab), columns: (t.columns ?? []).map((c) => ({ ...c, id: uid('col') })) };
}
function freshSkillTab(t: SkillTab): SkillTab {
  return { ...clone(t), id: uid('stab'), columns: (t.columns ?? []).map((c) => ({ ...c, id: uid('scol') })) };
}

/** Apply selected sections of a GM preset onto the active character. */
export function applyPreset(presetId: string, sections: PresetSection[]): void {
  const r = get(ruleset);
  const preset = r.presets.find((p) => p.id === presetId);
  if (!preset) return;
  updateActive((c) => {
    let next = { ...c };
    if (sections.includes('stats') && preset.statTiers) next = { ...next, statTiers: { ...preset.statTiers } };
    if (sections.includes('standard') && preset.standardActionIds) {
      const keep = new Set(preset.standardActionIds);
      next = { ...next, hiddenStandardActionIds: r.standardActions.filter((a) => !keep.has(a.id)).map((a) => a.id) };
    }
    if (sections.includes('actionTabs') && preset.actionTabs?.length) {
      next = { ...next, actionTabs: [...next.actionTabs, ...preset.actionTabs.map(freshActionTab)] };
    }
    if (sections.includes('skillTabs')) {
      const add: SkillTab[] = [];
      if (preset.skillTabs?.length) add.push(...preset.skillTabs.filter((t) => !t.defaultInclude).map(freshSkillTab));
      if (add.length) next = { ...next, skillTabs: [...next.skillTabs, ...add] };
    }
    return next;
  });
}
export function applyPresetFull(presetId: string): void {
  applyPreset(presetId, ['stats', 'standard', 'actionTabs', 'skillTabs']);
}

export function createCharacter(name: string, statTiers?: Record<CoreStat, Tier>): string {
  const rules = get(ruleset);
  const char = newCharacter(name, rules, statTiers);
  const d = deriveCharacter(char, rules);
  char.hpCurrent = d.hpMax.effective;
  char.soulCurrent = d.soulMax.effective;
  for (const r of d.resources) char.resourceState[r.def.id] = r.max;
  characters.update(($c) => [...$c, char]);
  activeId.set(char.id);
  view.set('sheet');
  return char.id;
}

export function deleteCharacter(id: string): void {
  characters.update(($c) => $c.filter((c) => c.id !== id));
  if (get(activeId) === id) activeId.set(get(characters)[0]?.id ?? null);
}

export function acknowledgeRuleset(): void {
  const v = get(ruleset).version;
  updateActive((c) => ({ ...c, seenRulesetVersion: v }));
}

export function characterExists(id: string): boolean {
  return get(characters).some((c) => c.id === id);
}

export function importCharacter(char: Character, mode: 'overwrite' | 'copy'): string {
  const rules = get(ruleset);
  if (mode === 'copy') {
    const copy = clone(char);
    copy.id = uid('char');
    copy.name = `${char.name} (copy)`;
    const normalized = normalizeCharacter(copy, rules);
    characters.update(($c) => [...$c, normalized]);
    activeId.set(normalized.id);
    return normalized.id;
  }
  const normalized = normalizeCharacter(char, rules);
  characters.update(($c) => {
    const exists = $c.some((c) => c.id === normalized.id);
    return exists ? $c.map((c) => (c.id === normalized.id ? normalized : c)) : [...$c, normalized];
  });
  activeId.set(normalized.id);
  return normalized.id;
}

// ── Inventory ────────────────────────────────────────────────────────────────
export function addItemToInventory(itemId: string, bagId: string): void {
  updateActive((c) => ({
    ...c,
    inventory: [...c.inventory, { id: uid('inv'), itemId, bagId, equipped: false, qty: 1, weaponSlot: null }],
  }));
}

/** Assign an equipped weapon to the Main/Secondary slot (one of each). */
export function setWeaponSlot(entryId: string, slot: import('./types').WeaponSlot | null): void {
  const rules = get(ruleset);
  const itemsById = new Map(rules.items.map((i) => [i.id, i]));
  updateActive((c) => {
    const entry = c.inventory.find((e) => e.id === entryId);
    const item = entry ? itemsById.get(entry.itemId) : undefined;
    const isTwoHanded = item?.tags.includes('two-handed') ?? false;

    if (isTwoHanded && slot === 'secondary') return c; // 2H weapon can't go in secondary

    if (slot === 'secondary') {
      const mainEntry = c.inventory.find((e) => e.weaponSlot === 'main' && e.equipped);
      const mainItem = mainEntry ? itemsById.get(mainEntry.itemId) : undefined;
      // Block secondary only when main is a 2H weapon currently in 2H grip
      if (mainItem?.tags.includes('two-handed') && (mainEntry?.twoHandedGrip ?? false)) return c;
    }

    return {
      ...c,
      inventory: c.inventory.map((e) => {
        if (e.id === entryId) return { ...e, weaponSlot: slot };
        if (slot && e.weaponSlot === slot) return { ...e, weaponSlot: null };
        return e;
      }),
    };
  });
}

/** Toggle a two-handed weapon between 1H and 2H grip. Switching to 2H auto-unequips secondary. */
export function setWeaponGrip(entryId: string, twoHanded: boolean): void {
  updateActive((c) => {
    const entry = c.inventory.find((e) => e.id === entryId);
    const isMain = entry?.weaponSlot === 'main';
    return {
      ...c,
      inventory: c.inventory.map((e) => {
        if (e.id === entryId) return { ...e, twoHandedGrip: twoHanded };
        if (twoHanded && isMain && e.weaponSlot === 'secondary') return { ...e, weaponSlot: null };
        return e;
      }),
    };
  });
}

/** Reorder a bag to sit immediately before `beforeId` (or end if null). */
export function reorderBag(bagId: string, beforeId: string | null): void {
  updateActive((c) => {
    const arr = c.bags.filter((b) => b.id !== bagId);
    const moved = c.bags.find((b) => b.id === bagId);
    if (!moved) return c;
    const idx = beforeId ? arr.findIndex((b) => b.id === beforeId) : arr.length;
    arr.splice(idx < 0 ? arr.length : idx, 0, moved);
    return { ...c, bags: arr };
  });
}
export function removeInventoryEntry(entryId: string): void {
  updateActive((c) => ({ ...c, inventory: c.inventory.filter((e) => e.id !== entryId) }));
}
export function patchInventoryEntry(entryId: string, patch: Partial<import('./types').InventoryEntry>): void {
  updateActive((c) => ({
    ...c,
    inventory: c.inventory.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
  }));
}
export function addBag(name: string, column = 0): void {
  updateActive((c) => ({ ...c, bags: [...c.bags, { id: uid('bag'), name: name.trim() || 'Bag', column }] }));
}
export function moveBagToColumn(bagId: string, column: number): void {
  updateActive((c) => ({ ...c, bags: c.bags.map((b) => (b.id === bagId ? { ...b, column } : b)) }));
}
export function reorderBagIntoColumn(bagId: string, column: number, beforeId: string | null): void {
  updateActive((c) => {
    const bags = c.bags.map((b) => (b.id === bagId ? { ...b, column } : b));
    const arr = bags.filter((b) => b.id !== bagId);
    const moved = bags.find((b) => b.id === bagId)!;
    const idx = beforeId ? arr.findIndex((b) => b.id === beforeId) : arr.length;
    arr.splice(idx < 0 ? arr.length : idx, 0, moved);
    return { ...c, bags: arr };
  });
}
export function renameBag(bagId: string, name: string): void {
  updateActive((c) => ({ ...c, bags: c.bags.map((b) => (b.id === bagId ? { ...b, name } : b)) }));
}
export function deleteBag(bagId: string): void {
  updateActive((c) => {
    const fallback = c.bags.find((b) => b.id !== bagId)?.id;
    if (!fallback) return c; // keep at least one bag
    return {
      ...c,
      bags: c.bags.filter((b) => b.id !== bagId),
      inventory: c.inventory.map((e) => (e.bagId === bagId ? { ...e, bagId: fallback } : e)),
    };
  });
}

// ── Ruleset mutations ────────────────────────────────────────────────────────
export function importRuleset(next: Ruleset): void {
  ruleset.set(next);
}
export function resetRulesetToDefault(): void {
  ruleset.set(defaultRuleset());
}
/** Register tags into the global registry (pick-or-create, §5). */
export function ensureTags(tags: string[]): void {
  ruleset.update((r) => {
    const set = new Set(r.tags);
    let changed = false;
    for (const t of tags) {
      const v = t.trim();
      if (v && !set.has(v)) {
        set.add(v);
        changed = true;
      }
    }
    return changed ? { ...r, tags: [...set].sort() } : r;
  });
}

// ── Tree categories (known list + display order) ─────────────────────────────
/** Register a tree category into the known-list (used for ordering & pickers). */
export function addCategory(name: string): void {
  ruleset.update((r) => {
    const v = name.trim();
    if (!v || r.categories.includes(v)) return r;
    return { ...r, categories: [...r.categories, v] };
  });
}
/** Rename a category in the list and on every tree that uses it. */
export function renameCategory(oldName: string, name: string): void {
  ruleset.update((r) => {
    const v = name.trim();
    if (!v || v === oldName) return r;
    return {
      ...r,
      categories: r.categories.map((c) => (c === oldName ? v : c)).filter((c, i, a) => a.indexOf(c) === i),
      trees: r.trees.map((t) => (t.category === oldName ? { ...t, category: v } : t)),
    };
  });
}
/** Remove a category from the known-list (trees keep their value). */
export function deleteCategory(name: string): void {
  ruleset.update((r) => ({ ...r, categories: r.categories.filter((c) => c !== name) }));
}
/** Move a category one slot up (-1) or down (+1) in the display order. */
export function moveCategory(name: string, dir: -1 | 1): void {
  ruleset.update((r) => {
    const arr = [...r.categories];
    const i = arr.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return r;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...r, categories: arr };
  });
}

export function wipeAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.ruleset);
  localStorage.removeItem(STORAGE_KEYS.characters);
  localStorage.removeItem(STORAGE_KEYS.active);
  ruleset.set(defaultRuleset());
  characters.set([]);
  activeId.set(null);
  view.set('sheet');
}

export type { Bag };
