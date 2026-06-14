<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { view, gmMode, activeCharacter, characters, activeId } from '../stores';
  import type { ViewName } from '../stores';

  const dispatch = createEventDispatcher<{ manage: void; gate: void }>();

  const tabs: { id: ViewName; label: string }[] = [
    { id: 'sheet', label: 'Sheet' },
    { id: 'browser', label: 'Skills' },
    { id: 'inventory', label: 'Inventory' },
  ];

  function exitGm() {
    gmMode.set(false);
    if ($view === 'admin') view.set('sheet');
  }
</script>

<header class="topbar">
  <div class="brand">
    <span class="mark">❖</span>
    <span class="name">Veilbound</span>
  </div>

  <nav class="nav">
    {#each tabs as t}
      <button class="navbtn" class:active={$view === t.id} on:click={() => view.set(t.id)}>
        {t.label}
      </button>
    {/each}
    {#if $gmMode}
      <button class="navbtn admin" class:active={$view === 'admin'} on:click={() => view.set('admin')}>
        ⚙ Admin
      </button>
    {/if}
  </nav>

  <span class="spacer"></span>

  <div class="right">
    {#if $characters.length}
      <select
        class="charsel"
        value={$activeId ?? ''}
        on:change={(e) => activeId.set(e.currentTarget.value || null)}
        aria-label="Active character"
      >
        {#each $characters as c (c.id)}
          <option value={c.id}>{c.name} (Lv {c.level})</option>
        {/each}
      </select>
    {/if}
    <button class="ghost" on:click={() => dispatch('manage')}>
      {$activeCharacter ? 'Characters' : '+ Character'}
    </button>

    {#if $gmMode}
      <span class="gmbadge" title="GM mode active">GM</span>
      <button class="ghost" on:click={exitGm} title="Exit GM mode">🔓 Exit GM</button>
    {:else}
      <button class="ghost gear" on:click={() => dispatch('gate')} title="GM admin" aria-label="GM admin">⚙</button>
    {/if}
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.55rem 1rem;
    background: rgba(20, 19, 26, 0.85);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 60;
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .mark {
    color: var(--accent);
    font-size: 1.2em;
  }
  .name {
    background: linear-gradient(90deg, var(--accent), var(--gold));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .nav {
    display: flex;
    gap: 0.25rem;
  }
  .navbtn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 0.3em 0.9em;
  }
  .navbtn.active {
    background: var(--accent-2);
    border-color: var(--accent);
    color: #fff;
  }
  .navbtn.admin.active {
    background: var(--gold);
    color: #2a2410;
    border-color: var(--gold);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .charsel {
    max-width: 200px;
  }
  .gmbadge {
    background: var(--gold);
    color: #2a2410;
    font-weight: 700;
    font-size: 0.75em;
    padding: 0.15em 0.5em;
    border-radius: 4px;
  }
  .gear {
    font-size: 1.1em;
  }
</style>
