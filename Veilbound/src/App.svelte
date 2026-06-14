<script lang="ts">
  import { view, gmMode, activeCharacter, characters, openTreeId } from './lib/stores';
  import TopBar from './lib/components/TopBar.svelte';
  import CharacterSheet from './lib/components/CharacterSheet.svelte';
  import SkillBrowser from './lib/components/SkillBrowser.svelte';
  import InventoryView from './lib/components/InventoryView.svelte';
  import AdminPanel from './lib/components/AdminPanel.svelte';
  import TreeView from './lib/components/TreeView.svelte';
  import GmGate from './lib/components/GmGate.svelte';
  import CharacterManager from './lib/components/CharacterManager.svelte';
  import DragGhost from './lib/components/DragGhost.svelte';

  let showGate = false;
  let showManager = false;
</script>

<TopBar on:manage={() => (showManager = true)} on:gate={() => (showGate = true)} />

<main class="content">
  {#if $view === 'sheet'}
    {#if !$activeCharacter && $characters.length === 0}
      <div class="welcome panel">
        <h1>Welcome to Veilbound</h1>
        <p class="muted">
          A character builder and skill-tree designer for your tabletop game. Everything is saved in
          this browser — no account needed. Create a character to begin, or unlock GM mode (⚙) to
          edit the rules.
        </p>
        <button class="primary" on:click={() => (showManager = true)}>Create a character</button>
      </div>
    {:else}
      <CharacterSheet />
    {/if}
  {:else if $view === 'browser'}
    <SkillBrowser />
  {:else if $view === 'inventory'}
    {#if $activeCharacter}<InventoryView />{:else}<p class="muted">Create a character to manage inventory.</p>{/if}
  {:else if $view === 'admin'}
    {#if $gmMode}
      <AdminPanel />
    {:else}
      <p class="muted">GM mode is not active.</p>
    {/if}
  {/if}
</main>

{#if $openTreeId}
  <TreeView treeId={$openTreeId} />
{/if}

{#if showGate}
  <GmGate on:close={() => (showGate = false)} />
{/if}

{#if showManager}
  <CharacterManager on:close={() => (showManager = false)} />
{/if}

<DragGhost />

<style>
  .content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.2rem 1rem 4rem;
  }
  .welcome {
    text-align: center;
    padding: 3rem 2rem;
    max-width: 620px;
    margin: 3rem auto;
  }
  .welcome h1 {
    background: linear-gradient(90deg, var(--accent), var(--gold));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
</style>
