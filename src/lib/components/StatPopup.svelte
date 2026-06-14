<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DerivedValue } from '../engine/derive';
  import type { ModifierTarget } from '../types';
  import { updateActive, activeCharacter } from '../stores';
  import { uid } from '../util';
  import type { CoreStat } from '../types';
  import Modal from './Modal.svelte';
  import TierOrder, { tiersToOrder, orderToTiers } from './TierOrder.svelte';

  /** Per-stat/resource popup (§6). Shows the breakdown; adding modifiers is
      lock-gated behind a subtle grey lock in the top-right. */
  export let label: string;
  export let target: ModifierTarget;
  export let dv: DerivedValue;
  export let baseLabel: string | null = null; // override base display (e.g. AC range)
  export let effectiveLabel: string | null = null;

  const dispatch = createEventDispatcher();
  let unlocked = false;
  let name = '';
  let value = 1;

  // Redistribute tiers (§5). Only meaningful for the four core stats.
  const CORE = ['STR', 'DEX', 'KNO', 'WIL'];
  $: isCoreStat = CORE.includes(target);
  let redistributing = false;
  let order: CoreStat[] = [];
  function openRedistribute() {
    if ($activeCharacter) order = tiersToOrder($activeCharacter.statTiers);
    redistributing = true;
  }
  function saveRedistribute() {
    updateActive((c) => ({ ...c, statTiers: orderToTiers(order) }));
    redistributing = false;
  }

  function add() {
    const m = { id: uid('mod'), target, name: name.trim() || 'Modifier', value: Math.trunc(value) };
    updateActive((c) => ({ ...c, modifiers: [...c.modifiers, m] }));
    name = '';
    value = 1;
  }
  function remove(id: string) {
    updateActive((c) => ({ ...c, modifiers: c.modifiers.filter((m) => m.id !== id) }));
  }
</script>

<Modal title={label} on:close={() => dispatch('close')}>
  <div class="lockrow">
    <span class="faint small">{unlocked ? 'Editing modifiers' : 'Breakdown'}</span>
    <span class="spacer"></span>
    <button
      class="lock"
      class:on={unlocked}
      title={unlocked ? 'Lock modifiers' : 'Unlock to edit modifiers'}
      on:click={() => (unlocked = !unlocked)}
    >{unlocked ? '🔓' : '🔒'}</button>
  </div>

  <div class="lines">
    <div class="line"><span class="muted">Base (calculated)</span><span class="mono">{baseLabel ?? dv.base}</span></div>
    {#each dv.contributions as c (c.id)}
      <div class="line">
        <span>{c.name} <span class="src">{c.source}</span></span>
        <span class="mono" class:pos={c.value >= 0} class:neg={c.value < 0}>{c.value >= 0 ? '+' : ''}{c.value}</span>
        {#if unlocked && c.source === 'manual'}
          <button class="ghost small" on:click={() => remove(c.id)} aria-label="Remove">✕</button>
        {/if}
      </div>
    {/each}
    <div class="line total"><span>Effective</span><span class="mono">{effectiveLabel ?? dv.effective}</span></div>
  </div>

  {#if unlocked}
    <form class="add row wrap" on:submit|preventDefault={add}>
      <input class="nm" placeholder="Modifier name" bind:value={name} />
      <input class="num" type="number" bind:value step="1" aria-label="Value" />
      <button class="primary" type="submit">Add</button>
    </form>
    <p class="faint" style="font-size:.82em;margin:.4rem 0 0">
      Modifiers change the effective value, not the base calculation. Use a negative number to lower it.
    </p>
  {:else}
    <p class="faint" style="font-size:.82em;margin:.6rem 0 0">Unlock (🔒, top-right) to add or remove modifiers.</p>
  {/if}

  {#if isCoreStat}
    <div class="redist">
      {#if !redistributing}
        <button class="small" on:click={openRedistribute}>↕ Redistribute Stats</button>
      {:else}
        <p class="faint small" style="margin:.2rem 0">Drag to set tier priority (top = primary):</p>
        <TierOrder value={order} on:change={(e) => (order = e.detail)} />
        <div class="row" style="justify-content:flex-end;margin-top:.5rem"><button class="small" on:click={() => (redistributing = false)}>Cancel</button><button class="small primary" on:click={saveRedistribute}>Save</button></div>
      {/if}
    </div>
  {/if}
</Modal>

<style>
  .lockrow {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .lock {
    background: transparent;
    border: none;
    opacity: 0.3;
    font-size: 1.05em;
    padding: 0.2em;
  }
  .lock:hover,
  .lock.on {
    opacity: 1;
  }
  .small {
    font-size: 0.82em;
  }
  .redist {
    margin-top: 0.8rem;
    border-top: 1px solid var(--border);
    padding-top: 0.6rem;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
  }
  .src {
    font-size: 0.7em;
    opacity: 0.6;
    text-transform: uppercase;
  }
  .total {
    border-top: 1px solid var(--border);
    margin-top: 4px;
    padding-top: 4px;
    font-weight: 600;
  }
  .pos {
    color: var(--good);
  }
  .neg {
    color: var(--bad);
  }
  .add {
    margin-top: 0.8rem;
  }
  .add .nm {
    flex: 1;
    min-width: 140px;
  }
  .add .num {
    width: 80px;
  }
</style>
