<script lang="ts">
  import { flip } from 'svelte/animate';
  import type { Character, Ruleset, SkillTree } from '../types';
  import { computeTreeView } from '../engine/tree';
  import { openTree, updateActive } from '../stores';
  import { uid, clone } from '../util';
  import { dur } from '../motion';
  import { ghostDragStart, ghostDragMove, ghostDragEnd } from '../dragGhost';

  export let character: Character;
  export let ruleset: Ruleset;
  /** 'tabs' = only the tab bar; 'grid' = only the skill cards; 'both' = everything */
  export let mode: 'tabs' | 'grid' | 'both' = 'both';
  export let activeTab = '';

  let dragId: string | null = null;

  $: learning = ruleset.trees.filter((t) => {
    const p = character.trees[t.id];
    return p && Object.values(p.invested).some((v) => v > 0);
  });
  $: tabs = character.sheetSkillTabs ?? [];
  $: if (activeTab && !tabs.some((t) => t.id === activeTab)) activeTab = '';

  $: shown = (() => {
    if (!activeTab) return learning;
    const ids = tabs.find((t) => t.id === activeTab)?.treeIds ?? [];
    return learning.filter((t) => ids.includes(t.id));
  })();

  function prog(t: SkillTree) {
    const p = character.trees[t.id];
    const v = computeTreeView(t, p ?? { prereqMet: {}, invested: {} });
    return { owned: v.filter((x) => x.owned).length, total: v.length };
  }
  function addTab() {
    const t = { id: uid('stab'), name: `Tab ${tabs.length + 1}`, treeIds: [] };
    updateActive((c) => ({ ...c, sheetSkillTabs: [...(c.sheetSkillTabs ?? []), t] }));
    activeTab = t.id;
  }
  function renameTab(id: string, name: string) {
    updateActive((c) => ({ ...c, sheetSkillTabs: (c.sheetSkillTabs ?? []).map((t) => (t.id === id ? { ...t, name } : t)) }));
  }
  function deleteTab(id: string) {
    updateActive((c) => ({ ...c, sheetSkillTabs: (c.sheetSkillTabs ?? []).filter((t) => t.id !== id) }));
    if (activeTab === id) activeTab = '';
  }
  function moveTab(id: string, dir: -1 | 1) {
    updateActive((c) => {
      const arr = clone(c.sheetSkillTabs ?? []);
      const i = arr.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, sheetSkillTabs: arr };
    });
  }
  function addToTab(tabId: string, treeId: string) {
    if (!tabId) return;
    updateActive((c) => ({
      ...c,
      sheetSkillTabs: (c.sheetSkillTabs ?? []).map((t) => (t.id === tabId && !t.treeIds.includes(treeId) ? { ...t, treeIds: [...t.treeIds, treeId] } : t)),
    }));
  }
  function removeFromTab(tabId: string, treeId: string) {
    updateActive((c) => ({ ...c, sheetSkillTabs: (c.sheetSkillTabs ?? []).map((t) => (t.id === tabId ? { ...t, treeIds: t.treeIds.filter((x) => x !== treeId) } : t)) }));
  }

  let managing = false;
</script>

{#if mode !== 'grid'}
  <div class="tabbar">
    <button class="tab droptab" class:active={activeTab === ''} on:click={() => (activeTab = '')}
      on:dragover|preventDefault on:drop|preventDefault={() => (dragId = null)}>All</button>
    {#each tabs as t (t.id)}
      <button class="tab droptab" class:active={t.id === activeTab} class:dropping={dragId !== null}
        on:click={() => (activeTab = t.id)}
        on:dragover|preventDefault
        on:drop|preventDefault={() => { if (dragId) { addToTab(t.id, dragId); activeTab = t.id; } dragId = null; }}>
        {t.name} <span class="cnt">{t.treeIds.length}</span>
      </button>
    {/each}
    <button class="tab add" on:click={addTab} title="New tab">＋</button>
    <span class="spacer"></span>
    <button class="ghost small" on:click={() => (managing = !managing)}>{managing ? 'Done' : 'Edit tabs'}</button>
  </div>

  {#if managing}
    <div class="mgr">
      {#each tabs as t (t.id)}
        <div class="row">
          <input value={t.name} on:input={(e) => renameTab(t.id, e.currentTarget.value)} />
          <button class="small" on:click={() => moveTab(t.id, -1)}>←</button>
          <button class="small" on:click={() => moveTab(t.id, 1)}>→</button>
          <button class="small danger" on:click={() => deleteTab(t.id)}>Delete</button>
        </div>
      {/each}
      <p class="faint small">Drag a skill card onto a tab to add it.</p>
    </div>
  {/if}
{/if}

{#if mode !== 'tabs'}
  {#if shown.length === 0}
    <p class="faint">{activeTab ? 'No skills in this tab yet — drag some here.' : 'No skills learned or in progress yet.'}</p>
  {:else}
    <div class="grid">
      {#each shown as t (t.id)}
        {@const p = prog(t)}
        <div class="card" draggable="true" animate:flip={{ duration: dur(220) }}
          on:dragstart={(e) => { ghostDragStart(e, t.name); dragId = t.id; }} on:drag={ghostDragMove} on:dragend={() => { ghostDragEnd(); dragId = null; }}>
          <div class="ctop"><strong>{t.name}</strong>{#if activeTab}<button class="x" on:click={() => removeFromTab(activeTab, t.id)} title="Remove from tab">×</button>{/if}</div>
          <div class="faint small">{p.owned}/{p.total} nodes · {t.category}</div>
          <button class="ghost small" on:click={() => openTree(t.id)}>Node view →</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .tabbar { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .tab { border-radius: 999px; padding: 0.25em 0.8em; }
  .tab.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .tab.dropping { border-color: var(--accent); border-style: dashed; }
  .cnt { opacity: 0.7; font-size: 0.85em; }
  .mgr { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem; }
  .mgr input { flex: 1; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.6rem; }
  .card { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; cursor: grab; }
  .card:active { cursor: grabbing; }
  .ctop { display: flex; justify-content: space-between; align-items: baseline; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1em; }
  .x:hover { color: var(--bad); }
  .small { font-size: 0.85em; }
  .card button.ghost { align-self: flex-start; }
</style>
