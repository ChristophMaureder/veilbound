<script lang="ts">
  import { flip } from 'svelte/animate';
  import type { Character, ActionTab } from '../types';
  import type { FormulaContext } from '../engine/formula';
  import { ownedActions, actionTags, presetProvides, type OwnedAction } from '../selectors';
  import { ruleset as rulesetStore, updateActive, ensureTags, toggleHiddenStandardAction, applyPreset } from '../stores';
  import { uid, clone } from '../util';
  import { dur } from '../motion';
  import { ghostDragStart, ghostDragMove, ghostDragEnd } from '../dragGhost';
  import ActionCard from './ActionCard.svelte';
  import TagPicker from './TagPicker.svelte';

  import type { Derived } from '../engine/derive';
  export let character: Character;
  export let ctx: FormulaContext;
  export let derived: Derived;

  let activeTopId = '';
  let activeSubId = '';
  let editing = false;
  let dragName: string | null = null;
  let costDragLabel: string | null = null;
  let tabSearch = '';
  let tabSearchOpen = false;
  let addByMode: 'name' | 'tag' | 'category' = 'name';
  let presetMenuOpen = false;

  $: ruleset = $rulesetStore;
  $: tabs = character.actionTabs;
  $: all = ownedActions(character, ruleset);
  $: availTags = actionTags(all, true);

  $: if (tabs.length && !tabs.some((t) => t.id === activeTopId)) { activeTopId = tabs[0].id; activeSubId = ''; }
  $: activeTop = tabs.find((t) => t.id === activeTopId) ?? null;
  $: subTabs = activeTop?.children ?? [];
  $: if (activeSubId && !subTabs.some((s) => s.id === activeSubId)) activeSubId = '';
  $: activeTab = (activeSubId ? subTabs.find((s) => s.id === activeSubId) : activeTop) ?? null;
  $: isAllTab = !activeSubId && activeTop?.kind === 'all';
  $: isStandardTab = !activeSubId && activeTop?.kind === 'standard';
  $: hiddenStd = new Set(character.hiddenStandardActionIds ?? []);

  function tagsOf(o: OwnedAction): string[] {
    return [...o.action.ruleTags, ...o.action.findingTags];
  }
  function inTab(o: OwnedAction, tab: ActionTab): boolean {
    const lname = o.action.name.toLowerCase();
    if (tab.names.some((n) => n.toLowerCase() === lname)) return true;
    if ((tab.categories ?? []).length && o.sourceCategory && tab.categories!.includes(o.sourceCategory)) return true;
    const hasFilters = tab.tags.length > 0 || (tab.categories ?? []).length > 0 || tab.names.length > 0;
    if (!hasFilters) return tab.defaultInclude ?? false;
    if (tab.tags.length === 0) return false;
    return tab.matchMode === 'all' ? tab.tags.every((t) => tagsOf(o).includes(t)) : tab.tags.some((t) => tagsOf(o).includes(t));
  }
  // Hidden standard actions vanish in play but remain visible (to re-enable) while editing.
  $: visibleAll = editing ? all : all.filter((o) => !(o.source === 'standard' && hiddenStd.has(o.action.id)));
  $: shown = activeTab
    ? (isStandardTab ? visibleAll.filter((o) => o.source === 'standard')
       : isAllTab ? visibleAll
       : visibleAll.filter((o) => inTab(o, activeTab)))
    : [];
  $: allSourceCategories = [...new Set(all.map((o) => o.sourceCategory).filter(Boolean) as string[])].sort();

  // ── mutators ────────────────────────────────────────────────────────────
  function newTab(name: string): ActionTab {
    return { id: uid('tab'), name, tags: [], names: [], categories: [], matchMode: 'any', showDescriptions: true, defaultInclude: false, layout: 'list', columnSize: 1, columns: [], costOrder: [], unsortedLabel: 'Unsorted', hideUnsorted: false, children: [] };
  }
  function setTabs(next: ActionTab[]) { updateActive((c) => ({ ...c, actionTabs: next })); }
  function mapTab(list: ActionTab[], id: string, fn: (t: ActionTab) => ActionTab): ActionTab[] {
    return list.map((t) => (t.id === id ? fn(t) : { ...t, children: mapTab(t.children, id, fn) }));
  }
  function patchTab(id: string, patch: Partial<ActionTab>) { setTabs(mapTab(clone(tabs), id, (t) => ({ ...t, ...patch }))); }
  function addTopTab() { const t = newTab(`Tab ${tabs.length + 1}`); setTabs([...clone(tabs), t]); activeTopId = t.id; activeSubId = ''; editing = true; }
  function addSubTab() { if (!activeTop) return; const t = newTab(`Sub ${activeTop.children.length + 1}`); setTabs(mapTab(clone(tabs), activeTop.id, (x) => ({ ...x, children: [...x.children, t] }))); activeSubId = t.id; }
  function deleteTab(id: string) {
    const rm = (list: ActionTab[]): ActionTab[] => list.filter((t) => t.id !== id).map((t) => ({ ...t, children: rm(t.children) }));
    setTabs(rm(clone(tabs)));
    editing = false;
  }
  function moveSibling(id: string, dir: -1 | 1) {
    const move = (list: ActionTab[]): ActionTab[] => {
      const i = list.findIndex((t) => t.id === id);
      if (i >= 0) { const j = i + dir; if (j < 0 || j >= list.length) return list; const c = [...list]; [c[i], c[j]] = [c[j], c[i]]; return c; }
      return list.map((t) => ({ ...t, children: move(t.children) }));
    };
    setTabs(move(clone(tabs)));
  }
  $: allActionNames = [...new Set(all.map((o) => o.action.name))].sort();
  function addName(tab: ActionTab, name: string) {
    const n = name.trim();
    if (!n || tab.names.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    patchTab(tab.id, { names: [...tab.names, n] });
  }
  function removeName(tab: ActionTab, name: string) { patchTab(tab.id, { names: tab.names.filter((x) => x !== name) }); }
  function addCategory(tab: ActionTab, cat: string) {
    const cats = tab.categories ?? [];
    if (!cat || cats.includes(cat)) return;
    patchTab(tab.id, { categories: [...cats, cat] });
  }
  function removeCategory(tab: ActionTab, cat: string) { patchTab(tab.id, { categories: (tab.categories ?? []).filter((c) => c !== cat) }); }

  function toggleHide(o: OwnedAction) { toggleHiddenStandardAction(o.action.id); }

  $: actionPresets = ruleset.presets.filter((p) => presetProvides(p, 'actionTabs') || presetProvides(p, 'standard'));
  function applyActionPreset(id: string) { applyPreset(id, ['actionTabs', 'standard']); presetMenuOpen = false; }

  function jumpTo(top: ActionTab, sub?: ActionTab) { activeTopId = top.id; activeSubId = sub?.id ?? ''; tabSearch = ''; tabSearchOpen = false; }
  $: tabSearchResults = (() => {
    const q = tabSearch.trim().toLowerCase();
    const out: { top: ActionTab; sub?: ActionTab; label: string }[] = [];
    for (const t of tabs) {
      if (!q || t.name.toLowerCase().includes(q)) out.push({ top: t, label: t.name });
      for (const s of t.children) if (!q || s.name.toLowerCase().includes(q)) out.push({ top: t, sub: s, label: `${t.name} › ${s.name}` });
    }
    return out;
  })();

  // drag an action onto a tab header -> add by name, stay on current tab
  function dropOnTab(top: ActionTab, sub?: ActionTab) {
    if (!dragName) return;
    ghostDragEnd();
    const target = sub ?? top;
    addName(target, dragName);
    dragName = null;
  }

  // custom columns
  function addColumn() {
    if (!activeTab) return;
    patchTab(activeTab.id, { columns: [...activeTab.columns, { id: uid('col'), name: `Column ${activeTab.columns.length + 1}`, members: [] }] });
  }
  function renameColumn(colId: string, name: string) {
    if (!activeTab) return;
    patchTab(activeTab.id, { columns: activeTab.columns.map((c) => (c.id === colId ? { ...c, name } : c)) });
  }
  function deleteColumn(colId: string) {
    if (!activeTab) return;
    const idx = activeTab.columns.findIndex((c) => c.id === colId);
    if (idx < 0) return;
    const col = activeTab.columns[idx];
    // Block if it's the last column and has live items in it
    if (activeTab.columns.length === 1 && shown.some((o) => col.members.includes(o.action.name))) return;
    const remaining = activeTab.columns.filter((c) => c.id !== colId);
    if (col.members.length > 0) {
      if (idx > 0) {
        // Move members to the column on the left
        remaining[idx - 1] = { ...remaining[idx - 1], members: [...remaining[idx - 1].members, ...col.members] };
      } else {
        // No column to the left — reveal unsorted so items aren't lost
        patchTab(activeTab.id, { columns: remaining, hideUnsorted: false });
        return;
      }
    }
    patchTab(activeTab.id, { columns: remaining });
  }
  function dropInColumn(colId: string) {
    if (!activeTab || !dragName) return;
    ghostDragEnd();
    const cols = activeTab.columns.map((c) => ({ ...c, members: c.members.filter((m) => m !== dragName) }));
    const target = cols.find((c) => c.id === colId);
    if (target) target.members = [...target.members, dragName];
    patchTab(activeTab.id, { columns: cols });
    dragName = null;
  }
  function colMembers(colId: string): OwnedAction[] {
    const names = activeTab?.columns.find((c) => c.id === colId)?.members ?? [];
    return shown.filter((o) => names.includes(o.action.name));
  }
  $: unsorted = activeTab?.layout === 'custom'
    ? shown.filter((o) => !activeTab.columns.some((c) => c.members.includes(o.action.name)))
    : [];

  // cost grouping (respects saved costOrder)
  $: costGroups = (() => {
    const discovery: string[] = [];
    const m = new Map<string, OwnedAction[]>();
    for (const o of shown) { const k = o.action.cost || '—'; if (!m.has(k)) { m.set(k, []); discovery.push(k); } m.get(k)!.push(o); }
    const saved = activeTab?.costOrder ?? [];
    const keys = saved.length
      ? [...saved.filter((k) => m.has(k)), ...discovery.filter((k) => !saved.includes(k))]
      : discovery;
    return keys.map((k) => ({ label: k, items: m.get(k)! }));
  })();

  function reorderCostGroup(targetLabel: string) {
    if (!costDragLabel || !activeTab || costDragLabel === targetLabel) { costDragLabel = null; return; }
    const current = activeTab.costOrder?.length ? [...activeTab.costOrder] : costGroups.map((g) => g.label);
    if (!current.includes(costDragLabel)) current.push(costDragLabel);
    const without = current.filter((l) => l !== costDragLabel);
    const idx = without.indexOf(targetLabel);
    without.splice(idx >= 0 ? idx : without.length, 0, costDragLabel);
    patchTab(activeTab.id, { costOrder: without });
    costDragLabel = null;
  }
</script>

<div class="actions">
  <div class="tabbar">
    {#each tabs as t (t.id)}
      {#if !(t.hidden ?? false) || editing || t.id === activeTopId}
        <button class="tab" class:active={t.id === activeTopId} class:dotted={t.hidden} on:click={() => jumpTo(t)}
          on:dragover|preventDefault on:drop|preventDefault={() => dropOnTab(t)}>{t.name}</button>
      {/if}
    {/each}
    <button class="tab add" on:click={addTopTab} title="New tab">＋</button>
    <span class="spacer"></span>
    <div class="tabsearch">
      <input placeholder="Find tab…" bind:value={tabSearch} on:focus={() => (tabSearchOpen = true)} on:blur={() => setTimeout(() => (tabSearchOpen = false), 150)} />
      {#if tabSearchOpen}<div class="menu scrollbar">{#each tabSearchResults as r}<button class="opt" on:click={() => jumpTo(r.top, r.sub)}>{r.label}</button>{/each}</div>{/if}
    </div>
    {#if actionPresets.length}
      <div class="presetmenu">
        <button class="ghost small" on:click={() => (presetMenuOpen = !presetMenuOpen)} on:blur={() => setTimeout(() => (presetMenuOpen = false), 150)}>Apply preset ▾</button>
        {#if presetMenuOpen}<div class="menu scrollbar">{#each actionPresets as p (p.id)}<button class="opt" on:click={() => applyActionPreset(p.id)}>{p.name}</button>{/each}</div>{/if}
      </div>
    {/if}
    {#if activeTab}<button class="ghost small" on:click={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button>{/if}
  </div>

  {#if activeTop && subTabs.length}
    <div class="subbar">
      <button class="subtab" class:active={activeSubId === ''} on:click={() => (activeSubId = '')}>All</button>
      {#each subTabs as s (s.id)}
        <button class="subtab" class:active={s.id === activeSubId} on:click={() => (activeSubId = s.id)}
          on:dragover|preventDefault on:drop|preventDefault={() => dropOnTab(activeTop, s)}>{s.name}</button>
      {/each}
    </div>
  {/if}

  {#if editing && activeTab}
    <div class="editor panel">
      <div class="row wrap" style="align-items:center">
        <input class="name" value={activeTab.name} on:input={(e) => patchTab(activeTab.id, { name: e.currentTarget.value })} />
        <button class="small" on:click={() => moveSibling(activeTab.id, -1)}>←</button>
        <button class="small" on:click={() => moveSibling(activeTab.id, 1)}>→</button>
        {#if !activeSubId}<button class="small" on:click={addSubTab}>+ Sub-tab</button>{/if}
        <button class="danger small" on:click={() => deleteTab(activeTab.id)}>Delete</button>
      </div>
      <div class="opts row wrap">
        <label class="row" style="gap:.3rem"><input type="checkbox" checked={activeTab.defaultInclude ?? false} on:change={(e) => patchTab(activeTab.id, { defaultInclude: e.currentTarget.checked })} /> Show all by default</label>
        <label class="row" style="gap:.3rem"><input type="checkbox" checked={activeTab.hidden ?? false} on:change={(e) => patchTab(activeTab.id, { hidden: e.currentTarget.checked })} /> Hide tab (dotted while editing)</label>
        <label class="row" style="gap:.3rem">Match
          <select value={activeTab.matchMode} on:change={(e) => patchTab(activeTab.id, { matchMode: e.currentTarget.value === 'all' ? 'all' : 'any' })}><option value="any">any tag</option><option value="all">all tags</option></select></label>
        <label class="row" style="gap:.3rem"><input type="checkbox" checked={activeTab.showDescriptions} on:change={(e) => patchTab(activeTab.id, { showDescriptions: e.currentTarget.checked })} /> Descriptions</label>
        <label class="row" style="gap:.3rem">Layout
          <select value={activeTab.layout} on:change={(e) => patchTab(activeTab.id, { layout: e.currentTarget.value === 'cost' ? 'cost' : e.currentTarget.value === 'custom' ? 'custom' : 'list' })}><option value="list">List</option><option value="cost">By cost</option><option value="custom">Custom columns</option></select></label>
        {#if activeTab.layout !== 'list'}<label class="row" style="gap:.3rem">Size<input type="range" min="0.7" max="2" step="0.1" value={activeTab.columnSize} on:input={(e) => patchTab(activeTab.id, { columnSize: Number(e.currentTarget.value) })} /></label>{/if}
        {#if activeTab.layout === 'custom'}<button class="small" on:click={addColumn}>+ Column</button>{/if}
        {#if activeTab.layout === 'custom' && (activeTab.hideUnsorted ?? false)}<button class="small" on:click={() => patchTab(activeTab.id, { hideUnsorted: false })}>+ Unsorted column</button>{/if}
      </div>
      <div><label>Filter tags:</label><TagPicker selected={activeTab.tags} available={availTags} on:change={(e) => patchTab(activeTab.id, { tags: e.detail })} on:create={(e) => ensureTags([e.detail])} /></div>
      <div class="names">
        <label class="row" style="gap:.5rem;align-items:center">Add filter by:
          <select bind:value={addByMode} class="small"><option value="name">Name</option><option value="tag">Tag (above)</option><option value="category">Source category</option></select>
        </label>
        {#if addByMode === 'name'}
          <div class="row wrap" style="margin-top:.3rem">
            {#each activeTab.names as n}<span class="pill">{n}<button class="x" on:click={() => removeName(activeTab, n)}>×</button></span>{/each}
            <select on:change={(e) => { const v = e.currentTarget.value; if (v) { addName(activeTab, v); e.currentTarget.value = ''; } }}>
              <option value="">+ add action…</option>
              {#each allActionNames.filter((n) => !activeTab.names.some((m) => m.toLowerCase() === n.toLowerCase())) as n}
                <option value={n}>{n}</option>
              {/each}
            </select>
          </div>
        {:else if addByMode === 'category'}
          <div class="row wrap" style="margin-top:.3rem">
            {#each activeTab.categories ?? [] as c}<span class="pill">{c}<button class="x" on:click={() => removeCategory(activeTab, c)}>×</button></span>{/each}
            <select class="small" on:change={(e) => { if (e.currentTarget.value) { addCategory(activeTab, e.currentTarget.value); e.currentTarget.value = ''; } }}>
              <option value="">+ add category…</option>
              {#each allSourceCategories.filter((c) => !(activeTab.categories ?? []).includes(c)) as c}<option value={c}>{c}</option>{/each}
            </select>
          </div>
        {:else}
          <p class="faint small" style="margin:.2rem 0">Use the tag picker above.</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if shown.length === 0}
    <p class="faint">No matching actions{#if !isAllTab} — drag actions here, add tags, or type names in Edit{/if}.</p>
  {:else if activeTab?.layout === 'custom'}
    <div class="cols" style="--w:{180 * (activeTab.columnSize || 1)}px">
      {#each activeTab.columns as col (col.id)}
        <div class="colgroup" on:dragover|preventDefault on:drop|preventDefault={() => dropInColumn(col.id)}>
          <div class="colhead">
            {#if editing}<input value={col.name} on:input={(e) => renameColumn(col.id, e.currentTarget.value)} /><button class="x" on:click={() => deleteColumn(col.id)}>×</button>{:else}{col.name}{/if}
          </div>
          {#each colMembers(col.id) as oa (oa.action.id)}
            <div draggable="true" animate:flip={{ duration: dur(200) }} on:dragstart={(e) => { ghostDragStart(e, oa.action.name); dragName = oa.action.name; }} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); dragName = null; }}>
              <ActionCard owned={oa} {ctx} {derived} showDescription={activeTab.showDescriptions} {editing} hidden={hiddenStd.has(oa.action.id)} on:toggleHide={() => toggleHide(oa)} />
            </div>
          {/each}
        </div>
      {/each}
      {#if unsorted.length > 0 || !(activeTab.hideUnsorted ?? false)}
        <div class="colgroup unsorted" on:dragover|preventDefault on:drop|preventDefault={() => { /* drops here stay unsorted */ }}>
          <div class="colhead">
            {#if editing}
              <input value={activeTab.unsortedLabel ?? 'Unsorted'} on:input={(e) => patchTab(activeTab.id, { unsortedLabel: e.currentTarget.value })} />
              <button class="x" on:click={() => patchTab(activeTab.id, { hideUnsorted: true })} title="Hide unsorted column">×</button>
            {:else}
              {activeTab.unsortedLabel ?? 'Unsorted'}
            {/if}
          </div>
          {#each unsorted as oa (oa.action.id)}
            <div draggable="true" on:dragstart={(e) => { ghostDragStart(e, oa.action.name); dragName = oa.action.name; }} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); dragName = null; }}>
              <ActionCard owned={oa} {ctx} {derived} showDescription={activeTab.showDescriptions} {editing} hidden={hiddenStd.has(oa.action.id)} on:toggleHide={() => toggleHide(oa)} />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab?.layout === 'cost'}
    <div class="cols" style="--w:{180 * (activeTab.columnSize || 1)}px">
      {#each costGroups as g (g.label)}
        <div class="colgroup"
          on:dragover|preventDefault
          on:drop|preventDefault={() => { if (costDragLabel) reorderCostGroup(g.label); }}>
          <div class="colhead"
            draggable={editing}
            on:dragstart|stopPropagation={() => { costDragLabel = g.label; }}
            on:dragend={() => { costDragLabel = null; }}>
            {#if editing}<span class="drag-dots">⠿</span>{/if}{g.label}
          </div>
          {#each g.items as oa (oa.action.id)}
            <div draggable="true" on:dragstart={(e) => { ghostDragStart(e, oa.action.name); dragName = oa.action.name; }} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); dragName = null; }}><ActionCard owned={oa} {ctx} {derived} showDescription={activeTab.showDescriptions} {editing} hidden={hiddenStd.has(oa.action.id)} on:toggleHide={() => toggleHide(oa)} /></div>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid">
      {#each shown as oa (oa.action.id)}
        <div draggable="true" on:dragstart={(e) => { ghostDragStart(e, oa.action.name); dragName = oa.action.name; }} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); dragName = null; }}><ActionCard owned={oa} {ctx} {derived} showDescription={activeTab?.showDescriptions ?? true} {editing} hidden={hiddenStd.has(oa.action.id)} on:toggleHide={() => toggleHide(oa)} /></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tabbar { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
  .tab { border-radius: 999px; padding: 0.25em 0.8em; }
  .tab.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .tab.dotted { border-style: dashed; opacity: 0.65; }
  .subbar { display: flex; gap: 0.25rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .subtab { border-radius: 6px; padding: 0.15em 0.6em; font-size: 0.9em; }
  .subtab.active { background: var(--bg-3); border-color: var(--accent-2); }
  .tabsearch { position: relative; }
  .tabsearch input { width: 140px; }
  .presetmenu { position: relative; }
  .menu { position: absolute; right: 0; top: calc(100% + 2px); z-index: 30; min-width: 200px; max-height: 240px; overflow: auto; background: #0f0e15; border: 1px solid var(--border-2); border-radius: var(--radius-sm); box-shadow: var(--shadow); display: flex; flex-direction: column; }
  .opt { text-align: left; background: transparent; border: none; padding: 0.4em 0.6em; }
  .opt:hover { background: var(--bg-3); }
  .editor { margin-bottom: 0.6rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .editor .name { flex: 1; min-width: 160px; font-weight: 600; }
  .names .x, .pill .x { background: none; border: none; color: var(--text-dim); cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.6rem; }
  .cols { display: flex; gap: 0.8rem; overflow-x: auto; align-items: flex-start; }
  .colgroup { flex: 0 0 var(--w); display: flex; flex-direction: column; gap: 0.5rem; min-height: 60px; border: 1px dashed transparent; border-radius: var(--radius-sm); }
  .colgroup.unsorted { border-color: var(--border); padding: 0.3rem; }
  .colhead { font-weight: 700; text-align: center; padding: 0.2rem; background: var(--bg-3); border-radius: var(--radius-sm); text-transform: capitalize; display: flex; gap: 0.3rem; justify-content: center; align-items: center; }
  .colhead[draggable="true"] { cursor: grab; }
  .colhead[draggable="true"]:active { cursor: grabbing; }
  .colhead input { width: 100%; }
  .drag-dots { color: var(--text-faint); font-size: 0.9em; }
  .small { font-size: 0.85em; }
</style>
