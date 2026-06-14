<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Character } from '../types';
  import type { DerivedResource } from '../engine/derive';
  import { updateActive } from '../stores';
  import { clamp } from '../util';
  import { dur } from '../motion';
  import DotRow from './DotRow.svelte';
  import StatPopup from './StatPopup.svelte';
  import NumberAdjust from './NumberAdjust.svelte';

  export let character: Character;
  export let resources: DerivedResource[];

  let popup: DerivedResource | null = null;
  $: visible = resources.filter((r) => r.visible);

  function setRes(id: string, max: number, value: number) {
    updateActive((c) => ({ ...c, resourceState: { ...c.resourceState, [id]: clamp(value, 0, max) } }));
  }
</script>

<div class="col">
  {#if visible.length === 0}<p class="faint" style="margin:0">No resources yet. Some are granted by skills.</p>{/if}
  {#each visible as r (r.def.id)}
    {@const cur = clamp(character.resourceState[r.def.id] ?? 0, 0, r.max)}
    <div class="res" transition:slide|local={{ duration: dur(240) }}>
      <div class="head">
        <button class="lbl" on:click={() => (popup = r)} title="Breakdown & modifiers">{r.def.label}</button>
        {#if r.def.type === 'number'}<span class="spacer"></span><span class="bignum mono">{cur}<span class="faint slash">/{r.max}</span></span>{/if}
      </div>

      {#if r.def.type === 'dots'}
        <DotRow value={cur} max={r.max} colour={r.def.colour} on:change={(e) => setRes(r.def.id, r.max, e.detail)} />
      {:else if r.def.type === 'bar'}
        <div class="bar"><div class="fill" style="width:{r.max ? (cur / r.max) * 100 : 0}%; background:{r.def.colour}"></div></div>
        <div class="ctrlrow"><span class="faint mono">{cur}/{r.max}</span><span class="spacer"></span>
          <NumberAdjust on:add={(e) => setRes(r.def.id, r.max, cur + e.detail)} on:subtract={(e) => setRes(r.def.id, r.max, cur - e.detail)} /></div>
      {:else}
        <NumberAdjust on:add={(e) => setRes(r.def.id, r.max, cur + e.detail)} on:subtract={(e) => setRes(r.def.id, r.max, cur - e.detail)} />
      {/if}
    </div>
  {/each}
</div>

{#if popup}
  <StatPopup label={`${popup.def.label} (max)`} target={popup.def.id}
    dv={{ base: popup.baseMax, contributions: popup.contributions, effective: popup.max }} on:close={() => (popup = null)} />
{/if}

<style>
  .res { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; }
  .head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
  .lbl { background: transparent; border: none; padding: 0; font-weight: 600; color: var(--text); cursor: pointer; }
  .lbl:hover { color: var(--accent); }
  .grant { font-size: 0.7em; color: var(--mana); }
  .bignum { font-size: 1.7em; font-weight: 700; }
  .slash { font-size: 0.55em; font-weight: 400; }
  .bar { height: 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; transition: width 0.2s ease; }
  .ctrlrow { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.4rem; }
</style>
