<script lang="ts">
  import type { Derived } from '../engine/derive';
  import { setWeaponSlot } from '../stores';
  import Tooltip from './Tooltip.svelte';

  export let derived: Derived;
  $: weapons = [...derived.weapons].sort((a, b) => {
    const r = (s: string) => s === 'main' ? 0 : s === 'secondary' ? 1 : 2;
    return r(a.slot) - r(b.slot);
  });

  function toggleSlot(entryId: string, slot: 'main' | 'secondary', current: string) {
    setWeaponSlot(entryId, current === slot ? null : slot);
  }
</script>

{#if weapons.length}
  <section class="panel wep-panel">
    <h3 style="margin-bottom:.4rem">Equipped Weapons</h3>
    <div class="weapons">
      {#each weapons as w (w.entryId)}
        <div class="weapon" class:main={w.slot === 'main'} class:secondary={w.slot === 'secondary'}>
          <div class="wtop">
            <strong>{w.itemName}</strong>
            <span class="spacer"></span>
            <div class="slotbtns">
              <button class="sb" class:on={w.slot === 'main'} on:click={() => toggleSlot(w.entryId, 'main', w.slot)}>Main</button>
              <button class="sb" class:on={w.slot === 'secondary'} on:click={() => toggleSlot(w.entryId, 'secondary', w.slot)}>Secondary</button>
            </div>
          </div>
          {#each w.modes as m}
            <div class="mode">
              <div class="mname">{m.name}</div>
              <Tooltip placement="top">
                <span class="tohit">+{m.toHit} <span class="faint">to hit</span></span>
                <svelte:fragment slot="tip"><div>To-hit = {derived.prof} (prof) + {m.toHit - derived.prof} ({m.toHitStat})</div></svelte:fragment>
              </Tooltip>
              <span class="dmg">
                {#each m.damage as term, i}{#if i > 0}<span class="plus"> + </span>{/if}<Tooltip placement="top"><span class="term" style="color:{term.colour}" class:scale={term.isScale}>{term.notation}</span><svelte:fragment slot="tip"><span>{term.typeName}</span></svelte:fragment></Tooltip>{/each}
              </span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .wep-panel { font-size: 0.88em; }
  .weapons { display: flex; flex-direction: column; gap: 0.3rem; }
  .weapon { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.3rem 0.45rem; }
  .weapon.main { border-left: 3px solid var(--gold); }
  .weapon.secondary { border-left: 3px solid var(--accent-2); }
  .wtop { display: flex; align-items: center; gap: 0.4rem; }
  .slotbtns { display: flex; gap: 0.2rem; }
  .sb { font-size: 0.7em; padding: 0.08em 0.4em; }
  .sb.on { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .mode { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.15rem 0; flex-wrap: wrap; }
  .mname { font-weight: 600; min-width: 60px; }
  .tohit { font-variant-numeric: tabular-nums; cursor: help; }
  .dmg { font-weight: 600; font-variant-numeric: tabular-nums; }
  .term { cursor: help; }
  .term.scale { font-style: italic; }
  .plus { color: var(--text-dim); }
</style>
