<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    characters,
    activeId,
    createCharacter,
    deleteCharacter,
    importCharacter,
    characterExists,
    applyPreset,
    ruleset as rulesetStore,
  } from '../stores';
  import type { Character, CoreStat, Tier } from '../types';
  import { CORE_STATS } from '../types';
  import { downloadJSON, slug } from '../util';
  import Modal from './Modal.svelte';
  import TierOrder, { orderToTiers } from './TierOrder.svelte';

  const dispatch = createEventDispatcher();
  let newName = '';
  let creating = false;
  let order: CoreStat[] = ['STR', 'DEX', 'KNO', 'WIL'];
  let selectedPresetId: string | null = null; // null = blank slate
  let importError = '';
  let pendingImport: Character | null = null;
  let fileInput: HTMLInputElement;

  $: presets = $rulesetStore.presets;
  $: chosenPreset = selectedPresetId ? presets.find((p) => p.id === selectedPresetId) ?? null : null;

  const TIER_RANK: Record<Tier, number> = { pri: 0, sec: 1, tert: 2, quat: 3 };
  function tiersToOrder(t: Record<CoreStat, Tier>): CoreStat[] {
    return [...CORE_STATS].sort((a, b) => TIER_RANK[t[a]] - TIER_RANK[t[b]]);
  }
  function chooseBlank() { selectedPresetId = null; }
  function choosePreset(id: string) {
    selectedPresetId = id;
    const p = presets.find((x) => x.id === id);
    if (p?.statTiers) order = tiersToOrder(p.statTiers); // prefill for review
  }

  function startCreate() {
    creating = true;
  }
  function confirmCreate() {
    createCharacter(newName, orderToTiers(order));
    // Apply the template's non-stat sections (stats came from the reviewed order above).
    if (selectedPresetId) applyPreset(selectedPresetId, ['standard', 'actionTabs', 'skillTabs']);
    newName = '';
    creating = false;
    selectedPresetId = null;
    dispatch('close');
  }
  function select(id: string) {
    activeId.set(id);
    dispatch('close');
  }
  function exportChar(c: Character) {
    downloadJSON(`veilbound-${slug(c.name)}.json`, c);
  }
  async function onFile(e: Event) {
    importError = '';
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Character;
      if (!data || typeof data !== 'object' || !data.id || !Array.isArray(data.modifiers)) {
        importError = 'That does not look like a Veilbound character file.';
        return;
      }
      if (characterExists(data.id)) pendingImport = data;
      else {
        importCharacter(data, 'overwrite');
        dispatch('close');
      }
    } catch {
      importError = 'Could not read that file.';
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }
  function resolveImport(mode: 'overwrite' | 'copy') {
    if (!pendingImport) return;
    importCharacter(pendingImport, mode);
    pendingImport = null;
    dispatch('close');
  }
</script>

<Modal title="Characters" on:close={() => dispatch('close')}>
  {#if $characters.length === 0}
    <p class="faint">No characters yet. Create your first below.</p>
  {:else}
    <div class="list">
      {#each $characters as c (c.id)}
        <div class="crow" class:active={c.id === $activeId}>
          <button class="pick" on:click={() => select(c.id)}>
            <strong>{c.name}</strong><span class="faint">Level {c.level}</span>
          </button>
          <button class="ghost small" on:click={() => exportChar(c)} title="Export">⬇</button>
          <button class="danger small" on:click={() => deleteCharacter(c.id)} title="Delete">✕</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if creating}
    <div class="create panel">
      <div class="f"><label>Name</label><input bind:value={newName} placeholder="Character name" autofocus /></div>

      {#if presets.length}
        <label style="margin-top:.5rem">Start from:</label>
        <div class="row wrap" style="gap:.3rem">
          <button class="ptab" class:active={selectedPresetId === null} on:click={chooseBlank}>Blank slate</button>
          {#each presets as p (p.id)}
            <button class="ptab" class:active={selectedPresetId === p.id} on:click={() => choosePreset(p.id)}>{p.name}</button>
          {/each}
        </div>
        {#if chosenPreset}
          <p class="presetdesc faint">{chosenPreset.description || 'A prebuilt starting point.'} Its action tabs, skill tabs, and standard actions are applied on create — you can change everything afterwards. Review the stat order below.</p>
        {/if}
      {/if}

      <label style="margin-top:.5rem">Drag stats into priority order (top = primary):</label>
      <TierOrder value={order} on:change={(e) => (order = e.detail)} />
    </div>
  {/if}

  {#if pendingImport}
    <div class="badge-warn" style="margin-top:.8rem">
      A character with this id already exists ("{pendingImport.name}"). Overwrite, or import as a copy?
      <div class="row" style="margin-top:.5rem;justify-content:flex-end">
        <button class="small" on:click={() => (pendingImport = null)}>Cancel</button>
        <button class="small" on:click={() => resolveImport('copy')}>Import as copy</button>
        <button class="small danger" on:click={() => resolveImport('overwrite')}>Overwrite</button>
      </div>
    </div>
  {/if}
  {#if importError}<p class="err">{importError}</p>{/if}

  <svelte:fragment slot="footer">
    {#if creating}
      <button on:click={() => (creating = false)}>Cancel</button>
      <button class="primary" on:click={confirmCreate}>Create character</button>
    {:else}
      <button class="primary" on:click={startCreate}>+ New character</button>
      <button on:click={() => fileInput.click()}>Import…</button>
    {/if}
    <input bind:this={fileInput} type="file" accept="application/json,.json" on:change={onFile} hidden />
  </svelte:fragment>
</Modal>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .crow {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.2rem 0.3rem;
  }
  .crow.active {
    border-color: var(--accent-2);
  }
  .pick {
    flex: 1;
    text-align: left;
    background: transparent;
    border: none;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  .pick:hover {
    background: var(--bg-3);
  }
  .create {
    margin-top: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .err {
    color: var(--bad);
    font-size: 0.85em;
  }
  .ptab {
    border-radius: 999px;
    padding: 0.2em 0.7em;
  }
  .ptab.active {
    background: var(--accent-2);
    border-color: var(--accent);
    color: #fff;
  }
  .presetdesc {
    font-size: 0.85em;
    margin: 0.3rem 0 0;
  }
</style>
