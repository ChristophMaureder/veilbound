<script lang="ts">
  import { activeCharacter, ruleset as rulesetStore, gmMode, updateActive } from '../stores';
  import { visibleTrees, allTreeTags } from '../selectors';
  import type { SkillTree } from '../types';
  import { uid, clone } from '../util';
  import SkillCard from './SkillCard.svelte';
  import TagPicker from './TagPicker.svelte';

  $: ruleset = $rulesetStore;
  $: character = $activeCharacter;
  $: trees = visibleTrees(ruleset, $gmMode);
  $: tags = allTreeTags(trees);
  $: categories = [...new Set(trees.map((t) => t.category || 'Uncategorised'))];

  let groupBy: 'category' | 'all' = 'category';
  let query = '';
  let activeTags: string[] = [];
  let activeTabId = '';
  let managingTabs = false;

  $: skillTabs = character?.skillTabs ?? [];
  $: if (activeTabId && !skillTabs.some((t) => t.id === activeTabId)) activeTabId = '';

  $: tabTreeIds = activeTabId ? skillTabs.find((t) => t.id === activeTabId)?.treeIds ?? [] : null;
  $: filtered = trees.filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) return false;
    if (activeTags.length && !activeTags.every((tag) => t.tags.includes(tag))) return false;
    if (tabTreeIds && !tabTreeIds.includes(t.id)) return false;
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

  // User tab management (§1)
  function addTab() {
    const t = { id: uid('stab'), name: `Tab ${skillTabs.length + 1}`, treeIds: [] };
    updateActive((c) => ({ ...c, skillTabs: [...c.skillTabs, t] }));
    activeTabId = t.id;
  }
  function renameTab(id: string, name: string) {
    updateActive((c) => ({ ...c, skillTabs: c.skillTabs.map((t) => (t.id === id ? { ...t, name } : t)) }));
  }
  function deleteTab(id: string) {
    updateActive((c) => ({ ...c, skillTabs: c.skillTabs.filter((t) => t.id !== id) }));
    if (activeTabId === id) activeTabId = '';
  }
  function moveTab(id: string, dir: -1 | 1) {
    updateActive((c) => {
      const arr = clone(c.skillTabs);
      const i = arr.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, skillTabs: arr };
    });
  }
</script>

<div class="browser">
  <div class="controls panel">
    <div class="row wrap">
      <div class="seg">
        <button class:active={groupBy === 'category'} on:click={() => (groupBy = 'category')}>By Category</button>
        <button class:active={groupBy === 'all'} on:click={() => (groupBy = 'all')}>View All</button>
      </div>
      <input class="search" placeholder="Search name, tag, or description…" bind:value={query} />
    </div>
    <div>
      <label>Filter by tags (all must match):</label>
      <TagPicker selected={activeTags} available={tags} placeholder="Add a tag filter…" on:change={(e) => (activeTags = e.detail)} />
    </div>
  </div>

  {#if character}
    <div class="tabbar">
      <button class="tab" class:active={activeTabId === ''} on:click={() => (activeTabId = '')}>All Skills</button>
      {#each skillTabs as t (t.id)}
        <button class="tab" class:active={t.id === activeTabId} on:click={() => (activeTabId = t.id)}>{t.name} <span class="cnt">{t.treeIds.length}</span></button>
      {/each}
      <button class="tab add" on:click={addTab} title="New tab">＋</button>
      <span class="spacer"></span>
      <button class="ghost small" on:click={() => (managingTabs = !managingTabs)}>{managingTabs ? 'Done' : 'Manage tabs'}</button>
    </div>

    {#if managingTabs}
      <div class="tabmgr panel">
        {#if skillTabs.length === 0}<span class="faint">No tabs. Add one, then use “+ Tab” on a skill card to assign it.</span>{/if}
        {#each skillTabs as t (t.id)}
          <div class="mgrrow">
            <input value={t.name} on:input={(e) => renameTab(t.id, e.currentTarget.value)} />
            <button class="small" on:click={() => moveTab(t.id, -1)} title="Move left">←</button>
            <button class="small" on:click={() => moveTab(t.id, 1)} title="Move right">→</button>
            <button class="small danger" on:click={() => deleteTab(t.id)}>Delete</button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="count faint">{filtered.length} of {trees.length} skills{#if $gmMode} (GM: includes in-progress){/if}</div>

  {#if filtered.length === 0}
    <p class="faint">No skills match.</p>
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
  .browser {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .seg {
    display: flex;
  }
  .seg button {
    border-radius: 0;
  }
  .seg button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg button.active {
    background: var(--accent-2);
    border-color: var(--accent);
    color: #fff;
  }
  .search {
    flex: 1;
    min-width: 220px;
  }
  .tabbar {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .tab {
    border-radius: 999px;
    padding: 0.25em 0.8em;
  }
  .tab.active {
    background: var(--accent-2);
    border-color: var(--accent);
    color: #fff;
  }
  .cnt {
    opacity: 0.7;
    font-size: 0.85em;
  }
  .tabmgr {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .mgrrow {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .mgrrow input {
    flex: 1;
  }
  .catsec {
    margin-bottom: 0.5rem;
  }
  .cathead {
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.8rem;
    align-items: stretch;
  }
  .count {
    font-size: 0.85em;
  }
</style>
