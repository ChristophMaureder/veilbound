<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Searchable pick-or-create tag input (§5). Selected tags show as removable
      chips; typing filters existing tags and offers to create a new one. */
  export let selected: string[] = [];
  export let available: string[] = [];
  export let placeholder = 'Add tag…';
  export let allowCreate = true;

  const dispatch = createEventDispatcher<{ change: string[]; create: string }>();
  let query = '';
  let open = false;

  $: matches = available
    .filter((t) => !selected.includes(t))
    .filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);
  $: canCreate =
    allowCreate &&
    query.trim().length > 0 &&
    !available.some((t) => t.toLowerCase() === query.trim().toLowerCase()) &&
    !selected.some((t) => t.toLowerCase() === query.trim().toLowerCase());

  function add(tag: string) {
    const t = tag.trim();
    if (!t || selected.includes(t)) return;
    dispatch('change', [...selected, t]);
    query = '';
  }
  function create() {
    const t = query.trim();
    if (!t) return;
    dispatch('create', t);
    add(t);
  }
  function remove(tag: string) {
    dispatch('change', selected.filter((t) => t !== tag));
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length) add(matches[0]);
      else if (canCreate) create();
    }
  }
</script>

<div class="tp">
  <div class="chips">
    {#each selected as t (t)}
      <span class="pill chip">{t}<button class="x" on:click={() => remove(t)} aria-label="Remove {t}">×</button></span>
    {/each}
  </div>
  <div class="inputwrap">
    <input
      {placeholder}
      bind:value={query}
      on:focus={() => (open = true)}
      on:blur={() => setTimeout(() => (open = false), 150)}
      on:keydown={onKey}
    />
    {#if open && (matches.length || canCreate)}
      <div class="menu scrollbar">
        {#each matches as m}
          <button class="opt" on:click={() => add(m)}>{m}</button>
        {/each}
        {#if canCreate}
          <button class="opt create" on:click={create}>+ Create “{query.trim()}”</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .tp {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .x {
    background: none;
    border: none;
    padding: 0;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 1.1em;
    line-height: 1;
  }
  .x:hover {
    color: var(--bad);
  }
  .inputwrap {
    position: relative;
  }
  .inputwrap input {
    width: 100%;
  }
  .menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    max-height: 220px;
    overflow: auto;
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
    border-radius: 0;
    padding: 0.4em 0.6em;
  }
  .opt:hover {
    background: var(--bg-3);
  }
  .opt.create {
    color: var(--accent);
    border-top: 1px solid var(--border);
  }
</style>
