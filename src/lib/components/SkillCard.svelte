<script lang="ts">
  import type { Character, SkillTree } from '../types';
  import { treeStatus } from '../selectors';
  import { computeTreeView } from '../engine/tree';
  import { treeLocked, evalRequirements } from '../engine/requirements';
  import { openTree, updateActive, updateTreeProgress, ruleset as rulesetStore, derivedActive } from '../stores';

  export let tree: SkillTree;
  export let character: Character | null;
  export let showDesc = true;

  let menuOpen = false;
  $: status = treeStatus(character, tree);
  $: locked = treeLocked(tree, character, $rulesetStore, $derivedActive);
  $: reqChecks = character && $derivedActive ? evalRequirements(tree, character, $rulesetStore, $derivedActive) : [];
  function unlock() { updateTreeProgress(tree.id, (p) => ({ ...p, unlocked: true })); }
  $: prog = (() => {
    const p = character?.trees[tree.id];
    const v = computeTreeView(tree, p ?? { prereqMet: {}, invested: {} });
    return { owned: v.filter((x) => x.owned).length, total: v.length };
  })();

  const LABEL = { owned: 'Owned', available: 'Available' } as const;

  function inTab(tabId: string): boolean {
    return !!character?.skillTabs.find((t) => t.id === tabId)?.treeIds.includes(tree.id);
  }
  function toggleTab(tabId: string) {
    updateActive((c) => ({
      ...c,
      skillTabs: c.skillTabs.map((t) =>
        t.id === tabId
          ? { ...t, treeIds: t.treeIds.includes(tree.id) ? t.treeIds.filter((x) => x !== tree.id) : [...t.treeIds, tree.id] }
          : t,
      ),
    }));
  }
</script>

<div class="card" class:owned={status === 'owned'} class:locked>
  <div class="top">
    <strong class="nm">{tree.name}</strong>
    <span class="status {locked ? 'locked' : status}">{locked ? '🔒 Locked' : LABEL[status]}</span>
  </div>
  {#if tree.category}<div class="cat faint">{tree.category}{#if tree.subcategory} · {tree.subcategory}{/if}</div>{/if}
  {#if showDesc && tree.description}<p class="desc">{tree.description}</p>{/if}
  <div class="tags">{#each tree.tags as t}<span class="pill">{t}</span>{/each}</div>
  {#if locked}
    <div class="reqs">
      {#each reqChecks as c}<div class="req" class:met={c.met}>{c.met ? '✓' : '•'} {c.label} <span class="faint">{c.progress}</span></div>{/each}
      <button class="small unlock" on:click|stopPropagation={unlock}>🔓 Unlock</button>
    </div>
  {/if}
  {#if status === 'owned'}<div class="prog faint">{prog.owned}/{prog.total} nodes owned</div>{/if}
  <div class="actions row">
    <button class="primary small" on:click={() => openTree(tree.id)}>Node view</button>
    {#if character && character.skillTabs.length}
      <div class="tabmenu">
        <button class="small ghost" on:click={() => (menuOpen = !menuOpen)} on:blur={() => setTimeout(() => (menuOpen = false), 150)}>+ Tab ▾</button>
        {#if menuOpen}
          <div class="menu">
            {#each character.skillTabs as t (t.id)}
              <button class="opt" on:click={() => toggleTab(t.id)}>{inTab(t.id) ? '✓ ' : ''}{t.name}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .card.owned {
    border-color: color-mix(in srgb, var(--good) 40%, var(--border));
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }
  .nm {
    font-size: 1.05em;
  }
  .status {
    font-size: 0.72em;
    padding: 0.1em 0.5em;
    border-radius: 999px;
    background: var(--bg-3);
    color: var(--text-dim);
    white-space: nowrap;
  }
  .status.owned {
    background: rgba(94, 201, 138, 0.2);
    color: var(--good);
  }
  .status.available {
    background: rgba(124, 95, 212, 0.22);
    color: var(--accent);
  }
  .status.locked {
    background: rgba(224, 179, 74, 0.18);
    color: var(--warn);
  }
  .card.locked {
    border-color: color-mix(in srgb, var(--warn) 35%, var(--border));
  }
  .reqs {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.82em;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.5rem;
  }
  .req {
    color: var(--text-dim);
  }
  .req.met {
    color: var(--good);
  }
  .unlock {
    align-self: flex-start;
    margin-top: 0.2rem;
  }
  .cat {
    font-size: 0.78em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .desc {
    margin: 0;
    font-size: 0.9em;
    color: var(--text-dim);
  }
  .tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .prog {
    font-size: 0.82em;
  }
  .actions {
    margin-top: auto;
  }
  .tabmenu {
    position: relative;
  }
  .menu {
    position: absolute;
    z-index: 30;
    bottom: calc(100% + 2px);
    left: 0;
    min-width: 140px;
    background: #0f0e15;
    border: 1px solid var(--border-2);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
  }
  .opt {
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.4em 0.6em;
  }
  .opt:hover {
    background: var(--bg-3);
  }
</style>
