<script lang="ts">
  import type { DerivedValue } from '../engine/derive';
  import type { ModifierTarget } from '../types';
  import StatPopup from './StatPopup.svelte';

  export let label: string;
  export let abbr = '';
  export let target: ModifierTarget;
  export let dv: DerivedValue;
  export let rank = 0; // 0 = primary (largest) … 3 = quaternary (smallest)

  let open = false;
  $: delta = dv.effective - dv.base;
  // Tier conveyed purely by size + border weight (§1).
  const SIZES = ['2.4em', '2em', '1.6em', '1.3em'];
  const BORDERS = ['var(--accent)', 'var(--border-2)', 'var(--border)', 'var(--bg-3)'];
  $: valSize = SIZES[Math.min(rank, 3)];
  $: borderCol = BORDERS[Math.min(rank, 3)];
</script>

<button class="stat" style="--vsize:{valSize}; --bcol:{borderCol}" on:click={() => (open = true)} title="{label} — click for breakdown & modifiers">
  <div class="abbr">{abbr || label}</div>
  <div class="val">
    {dv.effective}
    {#if delta !== 0}<span class="delta" class:pos={delta > 0} class:neg={delta < 0}>{delta > 0 ? '+' : ''}{delta}</span>{/if}
  </div>
</button>

{#if open}<StatPopup {label} {target} {dv} on:close={() => (open = false)} />{/if}

<style>
  .stat {
    background: var(--bg-2);
    border: 4px solid var(--bcol);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.6rem;
    text-align: center;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 86px;
  }
  .stat:hover { border-color: var(--accent-2); }
  .abbr { font-size: 0.74em; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); }
  .val { font-size: var(--vsize); font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .delta { font-size: 0.45em; vertical-align: super; }
  .delta.pos { color: var(--good); }
  .delta.neg { color: var(--bad); }
</style>
