<script lang="ts" context="module">
  import type { CoreStat, Tier } from '../types';
  import { TIERS } from '../types';

  export function tiersToOrder(statTiers: Record<CoreStat, Tier>): CoreStat[] {
    const rank: Record<Tier, number> = { pri: 0, sec: 1, tert: 2, quat: 3 };
    return (['STR', 'DEX', 'KNO', 'WIL'] as CoreStat[]).slice().sort((a, b) => rank[statTiers[a]] - rank[statTiers[b]]);
  }
  export function orderToTiers(order: CoreStat[]): Record<CoreStat, Tier> {
    const out = {} as Record<CoreStat, Tier>;
    order.forEach((s, i) => (out[s] = TIERS[Math.min(i, 3)]));
    return out;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { flip } from 'svelte/animate';
  import { CORE_STAT_LABELS, TIER_LABELS } from '../types';
  import { dur } from '../motion';

  /** Drag the four stats into priority order: top = primary … (§5). */
  export let value: CoreStat[];
  const dispatch = createEventDispatcher<{ change: CoreStat[] }>();
  let dragIdx: number | null = null;

  function onDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...value];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    dragIdx = null;
    dispatch('change', next);
  }
</script>

<ol class="tierlist">
  {#each value as s, i (s)}
    <li class="trow" draggable="true" animate:flip={{ duration: dur(200) }}
      on:dragstart={() => (dragIdx = i)} on:dragend={() => (dragIdx = null)}
      on:dragover|preventDefault on:drop|preventDefault={() => onDrop(i)}>
      <span class="handle">⠿</span>
      <span class="tier">{TIER_LABELS[TIERS[Math.min(i, 3)]]}</span>
      <span class="name">{CORE_STAT_LABELS[s]}</span>
    </li>
  {/each}
</ol>

<style>
  .tierlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .trow { display: flex; align-items: center; gap: 0.6rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.45rem 0.6rem; cursor: grab; }
  .trow:active { cursor: grabbing; }
  .handle { color: var(--text-faint); }
  .tier { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); width: 90px; }
  .name { font-weight: 600; }
</style>
