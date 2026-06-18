<script lang="ts">
  import { activeCharacter, ruleset as rulesetStore, gmMode, updateActive, applyPreset } from '../stores';
  import { visibleTrees, allTreeTags, presetProvides } from '../selectors';
  import type { SkillTree, SkillTab } from '../types';
  import { uid, clone } from '../util';
  import { ghostDragStart, ghostDragMove, ghostDragEnd } from '../dragGhost';
  import SkillCard from './SkillCard.svelte';
  import TagPicker from './TagPicker.svelte';

  $: ruleset = $rulesetStore;
  $: character = $activeCharacter;
  $: trees = visibleTrees(ruleset, $gmMode);
  $: tags = allTreeTags(trees);
  $: treeNames = trees.map((t) => t.name).sort();
  $: allCategoryValues = [...new Set([
    ...trees.map((t) => t.category).filter(Boolean),
    ...trees.map((t) => t.subcategory ?? '').filter(Boolean),
  ])].sort();

  // View mode: per custom tab; "All Skills" is always category
  $: currentViewMode = activeTab ? (activeTab.viewMode ?? 'category') : 'category';
  function setViewMode(m: 'category' | 'all') {
    if (activeTab) patchTab(activeTab.id, { viewMode: m });
  }

  let activeTabId = '';
  let editing = false;
  let presetMenuOpen = false;
  $: skillPresets = ruleset.presets.filter((p) => presetProvides(p, 'skillTabs'));
  function applySkillPreset(id: string) { applyPreset(id, ['skillTabs']); presetMenuOpen = false; }

  // Drag state
  let dragTreeId: string | null = null;
  let dragCatName: string | null = null;
  let dragTabId: string | null = null;
  let addTabDrop = false;

  // 3 fuzzy filter inputs (transient, not persisted)
  let nameFilter = '';
  let catFilter = '';
  let tagFilter = '';
  let nameFilterOpen = false;
  let catFilterOpen = false;
  let tagFilterOpen = false;

  $: nameFilterMatches = (() => {
    const q = nameFilter.trim().toLowerCase();
    return treeNames.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 12);
  })();
  $: catFilterMatches = (() => {
    const q = catFilter.trim().toLowerCase();
    return allCategoryValues.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 12);
  })();
  $: tagFilterMatches = (() => {
    const q = tagFilter.trim().toLowerCase();
    return tags.filter((t) => !q || t.toLowerCase().includes(q)).slice(0, 12);
  })();

  $: skillTabs = character?.skillTabs ?? [];
  $: if (activeTabId && !skillTabs.some((t) => t.id === activeTabId)) activeTabId = '';
  $: activeTab = activeTabId ? skillTabs.find((t) => t.id === activeTabId) ?? null : null;

  function tabIncludes(tab: SkillTab, tree: SkillTree): boolean {
    if (tab.treeIds.includes(tree.id)) return true;
    if ((tab.nameFilters ?? []).some((n) => n.toLowerCase() === tree.name.toLowerCase())) return true;
    if ((tab.tagFilters ?? []).some((tag) => tree.tags.includes(tag))) return true;
    if ((tab.categoryFilters ?? []).some((c) => c === tree.category || c === (tree.subcategory ?? ''))) return true;
    return tab.defaultInclude ?? false;
  }

  $: filtered = trees.filter((t) => {
    if (nameFilter.trim()) {
      const q = nameFilter.trim().toLowerCase();
      if (!t.name.toLowerCase().includes(q)) return false;
    }
    if (catFilter.trim()) {
      const q = catFilter.trim().toLowerCase();
      if (!t.category.toLowerCase().includes(q) && !(t.subcategory ?? '').toLowerCase().includes(q)) return false;
    }
    if (tagFilter.trim()) {
      const q = tagFilter.trim().toLowerCase();
      if (!t.tags.some((tag) => tag.toLowerCase().includes(q))) return false;
    }
    if (activeTab && !tabIncludes(activeTab, t)) return false;
    return true;
  });

  // Two-level category grouping
  type SubGroup = { sub: string; trees: SkillTree[] };
  type CatGroup = { cat: string; direct: SkillTree[]; subs: SubGroup[] };
  $: grouped = (() => {
    if (currentViewMode !== 'category') return null;
    const catMap = new Map<string, { direct: SkillTree[]; subMap: Map<string, SkillTree[]> }>();
    for (const t of filtered) {
      const c = t.category || 'Uncategorised';
      if (!catMap.has(c)) catMap.set(c, { direct: [], subMap: new Map() });
      const entry = catMap.get(c)!;
      const sub = t.subcategory ?? '';
      if (sub) {
        if (!entry.subMap.has(sub)) entry.subMap.set(sub, []);
        entry.subMap.get(sub)!.push(t);
      } else {
        entry.direct.push(t);
      }
    }
    return [...catMap.entries()].map(([cat, { direct, subMap }]): CatGroup => ({
      cat, direct, subs: [...subMap.entries()].map(([sub, ts]) => ({ sub, trees: ts })),
    }));
  })();

  // ── Drag helpers ──────────────────────────────────────────────────────────
  function clearDrag() {
    dragTreeId = null; dragCatName = null; dragTabId = null;
    addTabDrop = false;
  }
  function startTreeDrag(e: DragEvent, tree: SkillTree) {
    ghostDragStart(e, tree.name); dragTreeId = tree.id; dragCatName = null;
  }
  function startCatDrag(e: DragEvent, catName: string) {
    ghostDragStart(e, catName); dragCatName = catName; dragTreeId = null;
  }

  function dropOnTab(tabId: string) {
    ghostDragEnd();
    if (dragTreeId) {
      const tab = skillTabs.find((t) => t.id === tabId);
      if (tab && !tab.treeIds.includes(dragTreeId)) patchTab(tabId, { treeIds: [...tab.treeIds, dragTreeId] });
    } else if (dragCatName) {
      const tab = skillTabs.find((t) => t.id === tabId);
      if (tab) {
        const existing = tab.categoryFilters ?? [];
        if (!existing.includes(dragCatName)) patchTab(tabId, { categoryFilters: [...existing, dragCatName] });
      }
    }
    clearDrag();
  }

  function dropOnAddTab() {
    ghostDragEnd();
    if (dragCatName) {
      const t = newTab(dragCatName);
      t.categoryFilters = [dragCatName];
      setTabs([...clone(skillTabs), t]);
      activeTabId = t.id; editing = true;
    }
    clearDrag();
  }

  // ── Tab mutations ─────────────────────────────────────────────────────────
  function setTabs(next: SkillTab[]) { updateActive((c) => ({ ...c, skillTabs: next })); }
  function newTab(name?: string): SkillTab {
    return { id: uid('stab'), name: name ?? `Tab ${skillTabs.length + 1}`, treeIds: [], defaultInclude: false, nameFilters: [], tagFilters: [], categoryFilters: [], columns: [] };
  }
  function addTab() { const t = newTab(); setTabs([...clone(skillTabs), t]); activeTabId = t.id; editing = true; }
  function patchTab(id: string, patch: Partial<SkillTab>) {
    setTabs(skillTabs.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function deleteTab(id: string) {
    setTabs(skillTabs.filter((t) => t.id !== id));
    if (activeTabId === id) { activeTabId = ''; editing = false; }
  }
  function moveTab(id: string, dir: -1 | 1) {
    const arr = clone(skillTabs);
    const i = arr.findIndex((t) => t.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setTabs(arr);
  }

  // Combobox state for the tab editor "include by name / category" pickers
  let nameQuery = '';
  let nameOpen = false;
  let catQuery = '';
  let catOpen = false;
  $: nameMatches = (() => {
    const q = nameQuery.trim().toLowerCase();
    const used = new Set((activeTab?.nameFilters ?? []).map((f) => f.toLowerCase()));
    return treeNames.filter((n) => !used.has(n.toLowerCase()) && (!q || n.toLowerCase().includes(q))).slice(0, 10);
  })();
  $: catMatches = (() => {
    const q = catQuery.trim().toLowerCase();
    const used = new Set(activeTab?.categoryFilters ?? []);
    return allCategoryValues.filter((c) => !used.has(c) && (!q || c.toLowerCase().includes(q))).slice(0, 10);
  })();
  function pickName(tab: SkillTab, n: string) { addName(tab, n); nameQuery = ''; nameOpen = false; }
  function pickCat(tab: SkillTab, c: string) { addCatFilter(tab, c); catQuery = ''; catOpen = false; }

  function addName(tab: SkillTab, name: string) {
    const n = name.trim(); if (!n) return;
    const existing = tab.nameFilters ?? [];
    if (existing.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    patchTab(tab.id, { nameFilters: [...existing, n] });
  }
  function removeName(tab: SkillTab, name: string) {
    patchTab(tab.id, { nameFilters: (tab.nameFilters ?? []).filter((n) => n !== name) });
  }
  function addCatFilter(tab: SkillTab, cat: string) {
    const existing = tab.categoryFilters ?? [];
    if (!cat || existing.includes(cat)) return;
    patchTab(tab.id, { categoryFilters: [...existing, cat] });
  }
  function removeCatFilter(tab: SkillTab, cat: string) {
    patchTab(tab.id, { categoryFilters: (tab.categoryFilters ?? []).filter((c) => c !== cat) });
  }


</script>

<div class="browser">
  <!-- 3-input fuzzy filter bar -->
  <div class="controls panel">
    <div class="filter-row">
      <div class="combo">
        <input class="combo-in" placeholder="Name…" bind:value={nameFilter}
          on:focus={() => (nameFilterOpen = true)}
          on:blur={() => setTimeout(() => (nameFilterOpen = false), 150)}
        />
        {#if nameFilterOpen && nameFilterMatches.length}
          <div class="menu scrollbar">
            {#each nameFilterMatches as n}
              <button class="opt" on:click={() => { nameFilter = n; nameFilterOpen = false; }}>{n}</button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="combo">
        <input class="combo-in" placeholder="Category…" bind:value={catFilter}
          on:focus={() => (catFilterOpen = true)}
          on:blur={() => setTimeout(() => (catFilterOpen = false), 150)}
        />
        {#if catFilterOpen && catFilterMatches.length}
          <div class="menu scrollbar">
            {#each catFilterMatches as c}
              <button class="opt" on:click={() => { catFilter = c; catFilterOpen = false; }}>{c}</button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="combo">
        <input class="combo-in" placeholder="Tag…" bind:value={tagFilter}
          on:focus={() => (tagFilterOpen = true)}
          on:blur={() => setTimeout(() => (tagFilterOpen = false), 150)}
        />
        {#if tagFilterOpen && tagFilterMatches.length}
          <div class="menu scrollbar">
            {#each tagFilterMatches as t}
              <button class="opt" on:click={() => { tagFilter = t; tagFilterOpen = false; }}>{t}</button>
            {/each}
          </div>
        {/if}
      </div>
      {#if nameFilter || catFilter || tagFilter}
        <button class="small ghost" on:click={() => { nameFilter = ''; catFilter = ''; tagFilter = ''; }}>Clear</button>
      {/if}
    </div>
  </div>

  {#if character}
    <div class="tabbar">
      <button class="tab" class:active={activeTabId === ''} on:click={() => { activeTabId = ''; editing = false; }}>All Skills</button>
      {#each skillTabs as t (t.id)}
        <button
          class="tab"
          class:active={t.id === activeTabId}
          class:drop-target={dragTabId === t.id && (!!dragTreeId || !!dragCatName)}
          on:click={() => { activeTabId = t.id; editing = false; }}
          on:dragover|preventDefault={() => (dragTabId = t.id)}
          on:dragleave={() => (dragTabId = null)}
          on:drop|preventDefault={() => dropOnTab(t.id)}
        >{t.name}</button>
      {/each}
      <button
        class="tab add"
        class:drop-target={addTabDrop && !!dragCatName}
        on:click={addTab}
        title="New tab — or drop a category here"
        on:dragover|preventDefault={() => { if (dragCatName) addTabDrop = true; }}
        on:dragleave={() => (addTabDrop = false)}
        on:drop|preventDefault={dropOnAddTab}
      >＋</button>
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

        <div class="row wrap" style="gap:.4rem;margin-top:.5rem;align-items:center">
          <label>View:</label>
          <div class="seg">
            <button class:active={(tab.viewMode ?? 'category') === 'category'} on:click={() => setViewMode('category')}>≡ Category</button>
            <button class:active={(tab.viewMode ?? 'category') === 'all'} on:click={() => setViewMode('all')}>Flat</button>
          </div>
        </div>

        <label class="row" style="gap:.4rem;margin-top:.5rem">
          <input type="checkbox" checked={tab.defaultInclude ?? false} on:change={(e) => patchTab(tab.id, { defaultInclude: e.currentTarget.checked })} />
          Show all skills by default (uncheck = only matched)
        </label>
        <div style="margin-top:.5rem">
          <label>Include by skill name:</label>
          <div class="row wrap" style="margin-top:.3rem;gap:.3rem;align-items:center">
            {#each tab.nameFilters ?? [] as n}
              <span class="pill">{n}<button class="x" on:click={() => removeName(tab, n)}>×</button></span>
            {/each}
            <div class="combo">
              <input class="combo-in" placeholder="Type a skill tree name…" bind:value={nameQuery}
                on:focus={() => (nameOpen = true)}
                on:blur={() => setTimeout(() => (nameOpen = false), 150)}
                on:keydown={(e) => { if (e.key === 'Enter' && nameQuery.trim()) pickName(tab, nameQuery.trim()); }} />
              {#if nameOpen && nameMatches.length}
                <div class="menu scrollbar">
                  {#each nameMatches as n}<button class="opt" on:click={() => pickName(tab, n)}>{n}</button>{/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
        <div style="margin-top:.5rem">
          <label>Include by category / subcategory:</label>
          <div class="row wrap" style="margin-top:.3rem;gap:.3rem;align-items:center">
            {#each tab.categoryFilters ?? [] as c}
              <span class="pill">{c}<button class="x" on:click={() => removeCatFilter(tab, c)}>×</button></span>
            {/each}
            <div class="combo">
              <input class="combo-in" placeholder="Type a category…" bind:value={catQuery}
                on:focus={() => (catOpen = true)}
                on:blur={() => setTimeout(() => (catOpen = false), 150)}
                on:keydown={(e) => { if (e.key === 'Enter' && catQuery.trim()) pickCat(tab, catQuery.trim()); }} />
              {#if catOpen && catMatches.length}
                <div class="menu scrollbar">
                  {#each catMatches as c}<button class="opt" on:click={() => pickCat(tab, c)}>{c}</button>{/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
        <div style="margin-top:.5rem">
          <label>Include by tag (any match):</label>
          <TagPicker selected={tab.tagFilters ?? []} available={tags} placeholder="Add a tag…" on:change={(e) => patchTab(tab.id, { tagFilters: e.detail })} />
        </div>

        {#if skillPresets.length}
          <div class="presetmenu" style="margin-top:.3rem">
            <button class="ghost small" on:click={() => (presetMenuOpen = !presetMenuOpen)} on:blur={() => setTimeout(() => (presetMenuOpen = false), 150)}>Apply preset ▾</button>
            {#if presetMenuOpen}<div class="menu scrollbar presetmenu-list">{#each skillPresets as p (p.id)}<button class="opt" on:click={() => applySkillPreset(p.id)}>{p.name}</button>{/each}</div>{/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  <div class="count faint">{filtered.length} of {trees.length} skills{#if $gmMode} (GM: includes in-progress){/if}</div>

  {#if filtered.length === 0}
    <p class="faint">No skills match{#if activeTab && !(activeTab.defaultInclude ?? false) && !(activeTab.nameFilters ?? []).length && !(activeTab.tagFilters ?? []).length && !(activeTab.categoryFilters ?? []).length} — edit the tab to add filters or enable "show all"{/if}.</p>

  {:else if grouped}
    <!-- Category view -->
    {#each grouped as { cat, direct, subs }}
      <section class="catsec">
        <h3 class="cathead" draggable="true"
          on:dragstart={(e) => startCatDrag(e, cat)}
          on:drag={ghostDragMove}
          on:dragend={() => { ghostDragEnd(); clearDrag(); }}
          title="Drag onto a tab to add this category as a filter"
        >{cat} <span class="faint">({direct.length + subs.reduce((n, s) => n + s.trees.length, 0)})</span></h3>
        {#if direct.length}
          <div class="grid">
            {#each direct as tree (tree.id)}
              <div draggable="true" on:dragstart={(e) => startTreeDrag(e, tree)} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); clearDrag(); }}>
                <SkillCard {tree} {character} />
              </div>
            {/each}
          </div>
        {/if}
        {#each subs as { sub, trees: subTrees }}
          <div class="subcatsec">
            <h4 class="subcathead" draggable="true"
              on:dragstart={(e) => startCatDrag(e, sub)}
              on:drag={ghostDragMove}
              on:dragend={() => { ghostDragEnd(); clearDrag(); }}
              title="Drag onto a tab to add this subcategory as a filter"
            >{sub} <span class="faint">({subTrees.length})</span></h4>
            <div class="grid">
              {#each subTrees as tree (tree.id)}
                <div draggable="true" on:dragstart={(e) => startTreeDrag(e, tree)} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); clearDrag(); }}>
                  <SkillCard {tree} {character} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {/each}

  {:else}
    <!-- Flat view -->
    <div class="grid">
      {#each filtered as tree (tree.id)}
        <div draggable="true" on:dragstart={(e) => startTreeDrag(e, tree)} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); clearDrag(); }}>
          <SkillCard {tree} {character} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .browser { display: flex; flex-direction: column; gap: 0.8rem; }
  .controls { display: flex; flex-direction: column; gap: 0.6rem; }
  .filter-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

  .tabbar {
    display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;
    position: sticky; top: 0; z-index: 10;
    background: var(--panel);
    padding: 0.4rem 0;
  }
  .tab { border-radius: 999px; padding: 0.25em 0.9em; }
  .tab.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .tab.drop-target { background: rgba(124, 95, 212, 0.15); outline: 2px dashed var(--accent); }

  .editor { display: flex; flex-direction: column; gap: 0.4rem; }
  .tabname { font-weight: 600; min-width: 180px; }
  .seg { display: flex; }
  .seg button { border-radius: 0; }
  .seg button:first-child { border-radius: 6px 0 0 6px; }
  .seg button:last-child { border-radius: 0 6px 6px 0; }
  .seg button.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }

  .catsec { margin-bottom: 0.5rem; }
  .cathead { border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; cursor: grab; }
  .cathead:active { cursor: grabbing; }
  .subcatsec { margin-top: 0.6rem; margin-left: 1rem; }
  .subcathead { font-size: 0.9em; color: var(--text-dim); border-bottom: 1px solid var(--border-2); padding-bottom: 0.2rem; margin-bottom: 0.5rem; cursor: grab; font-weight: 600; }
  .subcathead:active { cursor: grabbing; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.8rem; align-items: stretch; margin-top: 0.5rem; }

  .count { font-size: 0.85em; }
  .pill { display: inline-flex; align-items: center; gap: 0.2rem; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 999px; padding: 0.1em 0.5em; font-size: 0.85em; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 0 0 0.2em; }

  .presetmenu { position: relative; }
  .presetmenu-list { right: 0; left: auto; }
  .combo { position: relative; }
  .combo-in { min-width: 160px; }
  .menu { position: absolute; left: 0; top: calc(100% + 2px); z-index: 30; min-width: 180px; max-height: 240px; overflow: auto; background: #0f0e15; border: 1px solid var(--border-2); border-radius: var(--radius-sm); box-shadow: var(--shadow); display: flex; flex-direction: column; }
  .opt { text-align: left; background: transparent; border: none; padding: 0.55em 0.8em; }
  .opt:hover { background: var(--bg-3); }
</style>
