// ──────────────────────────────────────────────────────────────────────────
// Application state — Revision 2. All player/ruleset data persists to
// localStorage; GM mode, current view and the open tree are session-only.
// ──────────────────────────────────────────────────────────────────────────

import { writable, derived, get } from 'svelte/store';
import type { ActionTab, Bag, Character, CoreStat, Ruleset, SkillTab, Tier } from './types';
import { deriveCharacter, type Derived } from './engine/derive';
import { defaultActionTabs, defaultRuleset, newCharacter, STORAGE_KEYS } from './defaults';
import { clamp, clone, uid } from './util';

// ── Backfill migrations for data saved before newer fields existed ───────────
function migrateRuleset(r: Ruleset): Ruleset {
  const seed = defaultRuleset();
  return {
    ...r,
    standardActions: r.standardActions ?? seed.standardActions,
    presets: r.presets ?? seed.presets,
  };
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
  return { ...c, actionTabs, hiddenStandardActionIds: c.hiddenStandardActionIds ?? [] };
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
      if (preset.skillTabs?.length) add.push(...preset.skillTabs.map(freshSkillTab));
      if (preset.pinnedTreeIds?.length) add.push({ id: uid('stab'), name: preset.name, treeIds: [...preset.pinnedTreeIds], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: [], columns: [] });
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
  updateActive((c) => ({
    ...c,
    inventory: c.inventory.map((e) => {
      if (e.id === entryId) return { ...e, weaponSlot: slot };
      if (slot && e.weaponSlot === slot) return { ...e, weaponSlot: null }; // free the slot elsewhere
      return e;
    }),
  }));
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
