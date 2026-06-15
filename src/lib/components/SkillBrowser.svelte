<script lang="ts">
  import { activeCharacter, ruleset as rulesetStore, gmMode, updateActive } from '../stores';
  import { visibleTrees, allTreeTags } from '../selectors';
  import type { SkillTree, SkillTab } from '../types';
  import { uid, clone } from '../util';
  import SkillCard from './SkillCard.svelte';
  import TagPicker from './TagPicker.svelte';

  $: ruleset = $rulesetStore;
  $: character = $activeCharacter;
  $: trees = visibleTrees(ruleset, $gmMode);
  $: tags = allTreeTags(trees);
  $: treeNames = trees.map((t) => t.name).sort();

  let groupBy: 'category' | 'all' = 'category';
  let activeTabId = '';
  let editing = false;
  let addNameInput = '';

  // Per-tab transient search/tag filters (session only, not persisted)
  let tabQueries: Record<string, string> = {};
  let tabTagFilters: Record<string, string[]> = {};

  $: query = tabQueries[activeTabId] ?? '';
  $: activeTags = tabTagFilters[activeTabId] ?? [];
  function setQuery(q: string) { tabQueries = { ...tabQueries, [activeTabId]: q }; }
  function setTagFilter(ts: string[]) { tabTagFilters = { ...tabTagFilters, [activeTabId]: ts }; }

  $: skillTabs = character?.skillTabs ?? [];
  $: if (activeTabId && !skillTabs.some((t) => t.id === activeTabId)) activeTabId = '';
  $: activeTab = activeTabId ? skillTabs.find((t) => t.id === activeTabId) ?? null : null;

  function tabIncludes(tab: SkillTab, tree: SkillTree): boolean {
    const byId = tab.treeIds.includes(tree.id);
    const byName = (tab.nameFilters ?? []).some((n) => n.toLowerCase() === tree.name.toLowerCase());
    const byTag = (tab.tagFilters ?? []).some((tag) => tree.tags.includes(tag));
    if (byId || byName || byTag) return true;
    return tab.defaultInclude ?? false;
  }

  $: filtered = trees.filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) return false;
    if (activeTags.length && !activeTags.every((tag) => t.tags.includes(tag))) return false;
    if (activeTab && !tabIncludes(activeTab, t)) return false;
    return true;
  });

  $: grouped = (() => {
    if (groupBy === 'all') return null;
    const map = new Map<string, SkillTree[]>();
    for (const t of filtered) {
      const c = t.category || 'Uncategorised';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(t);
    }
    return [...map.entries()];
  })();

  function setTabs(next: SkillTab[]) { updateActive((c) => ({ ...c, skillTabs: next })); }
  function newTab(): SkillTab {
    return { id: uid('stab'), name: `Tab ${skillTabs.length + 1}`, treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [] };
  }
  function addTab() {
    const t = newTab();
    setTabs([...clone(skillTabs), t]);
    activeTabId = t.id;
    editing = true;
  }
  function patchTab(id: string, patch: Partial<SkillTab>) {
    setTabs(skillTabs.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function deleteTab(id: string) {
    setTabs(skillTabs.filter((t) => t.id !== id));
    if (activeTabId === id) { activeTabId = ''; editing = false; }
  }
  function moveTab(id: string, dir: -1 | 1) {
    const arr = clone(skillTabs);
    const i = arr.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setTabs(arr);
  }
  function addName(tab: SkillTab) {
    const n = addNameInput.trim();
    if (!n) return;
    const existing = tab.nameFilters ?? [];
    if (existing.some((x) => x.toLowerCase() === n.toLowerCase())) { addNameInput = ''; return; }
    patchTab(tab.id, { nameFilters: [...existing, n] });
    addNameInput = '';
  }
  function removeName(tab: SkillTab, name: string) {
    patchTab(tab.id, { nameFilters: (tab.nameFilters ?? []).filter((n) => n !== name) });
  }
</script>

<div class="browser">
  <div class="controls panel">
    <div class="row wrap">
      <div class="seg">
        <button class:active={groupBy === 'category'} on:click={() => (groupBy = 'category')}>By Category</button>
        <button class:active={groupBy === 'all'} on:click={() => (groupBy = 'all')}>View All</button>
      </div>
      <input class="search" placeholder="Search name, tag, or description…" value={query} on:input={(e) => setQuery(e.currentTarget.value)} />
    </div>
    <div>
      <label>Filter by tags (all must match):</label>
      <TagPicker selected={activeTags} available={tags} placeholder="Add a tag filter…" on:change={(e) => setTagFilter(e.detail)} />
    </div>
  </div>

  {#if character}
    <div class="tabbar">
      <button class="tab" class:active={activeTabId === ''} on:click={() => { activeTabId = ''; editing = false; }}>All Skills</button>
      {#each skillTabs as t (t.id)}
        <button class="tab" class:active={t.id === activeTabId} on:click={() => { activeTabId = t.id; editing = false; }}>{t.name}</button>
      {/each}
      <button class="tab add" on:click={addTab} title="New tab">＋</button>
      <span class="spacer"></span>
      {#if activeTab}
        <button class="ghost small" on:click={() => (editing = !editing)}>{editing ? 'Done' : 'Edit tab'}</button>
      {/if}
    </div>

    {#if editing && activeTab}
      {@const tab = activeTab}
      <div class="editor panel">
        <div class="row wrap" style="align-items:center;gap:.5rem">
          <input class="tabname" value={tab.name} on:input={(e) => patchTab(tab.id, { name: e.currentTarget.value })} placeholder="Tab name" />
          <button class="small" on:click={() => moveTab(tab.id, -1)}>←</button>
          <button class="small" on:click={() => moveTab(tab.id, 1)}>→</button>
          <button class="danger small" on:click={() => deleteTab(tab.id)}>Delete</button>
        </div>
        <label class="row" style="gap:.4rem;margin-top:.4rem">
          <input type="checkbox" checked={tab.defaultInclude ?? false} on:change={(e) => patchTab(tab.id, { defaultInclude: e.currentTarget.checked })} />
          Show all skills by default (uncheck = only matched)
        </label>
        <div style="margin-top:.5rem">
          <label>Include by skill name:</label>
          <div class="row wrap" style="margin-top:.3rem;gap:.3rem">
            {#each tab.nameFilters ?? [] as n}
              <span class="pill">{n}<button class="x" on:click={() => removeName(tab, n)}>×</button></span>
            {/each}
            <input list="sktree-names" placeholder="type a skill tree name…" bind:value={addNameInput}
              on:keydown={(e) => { if (e.key === 'Enter') addName(tab); }} style="min-width:180px" />
            <datalist id="sktree-names">{#each treeNames as n}<option value={n}></option>{/each}</datalist>
            <button class="small" on:click={() => addName(tab)}>+</button>
          </div>
        </div>
        <div style="margin-top:.5rem">
          <label>Include by tag (any match):</label>
          <TagPicker selected={tab.tagFilters ?? []} available={tags} placeholder="Add a tag…" on:change={(e) => patchTab(tab.id, { tagFilters: e.detail })} />
        </div>
      </div>
    {/if}
  {/if}

  <div class="count faint">{filtered.length} of {trees.length} skills{#if $gmMode} (GM: includes in-progress){/if}</div>

  {#if filtered.length === 0}
    <p class="faint">No skills match{#if activeTab && !(activeTab.defaultInclude ?? false) && !(activeTab.nameFilters ?? []).length && !(activeTab.tagFilters ?? []).length} — edit the tab to add filters or enable "show all"{/if}.</p>
  {:else if grouped}
    {#each grouped as [cat, list]}
      <section class="catsec">
        <h3 class="cathead">{cat} <span class="faint">({list.length})</span></h3>
        <div class="grid">{#each list as tree (tree.id)}<SkillCard {tree} {character} />{/each}</div>
      </section>
    {/each}
  {:else}
    <div class="grid">{#each filtered as tree (tree.id)}<SkillCard {tree} {character} />{/each}</div>
  {/if}
</div>

<style>
  .browser { display: flex; flex-direction: column; gap: 0.8rem; }
  .controls { display: flex; flex-direction: column; gap: 0.6rem; }
  .seg { display: flex; }
  .seg button { border-radius: 0; }
  .seg button:first-child { border-radius: 6px 0 0 6px; }
  .seg button:last-child { border-radius: 0 6px 6px 0; }
  .seg button.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .search { flex: 1; min-width: 220px; }
  .tabbar { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
  .tab { border-radius: 999px; padding: 0.25em 0.8em; }
  .tab.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .editor { display: flex; flex-direction: column; gap: 0.4rem; }
  .tabname { font-weight: 600; min-width: 180px; }
  .catsec { margin-bottom: 0.5rem; }
  .cathead { border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.8rem; align-items: stretch; }
  .count { font-size: 0.85em; }
  .pill { display: inline-flex; align-items: center; gap: 0.2rem; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 999px; padding: 0.1em 0.5em; font-size: 0.85em; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 0 0 0.2em; }
</style>
