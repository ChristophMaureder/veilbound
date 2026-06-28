<script lang="ts">
  import { interpolate } from '../engine/formula';
  import type { FormulaContext, DmgTypeInfo, WeaponDamageRefs } from '../engine/formula';
  import Tooltip from './Tooltip.svelte';

  export let text: string;
  export let ctx: FormulaContext;
  export let damageTypes: DmgTypeInfo[] = [];
  export let weaponRefs: WeaponDamageRefs | undefined = undefined;

  $: segments = interpolate(text, ctx, damageTypes, weaponRefs);
</script>

<span class="ftext"
  >{#each segments as seg}{#if seg.kind === 'text'}{seg.text}{:else if seg.kind === 'expr'}<Tooltip placement="top"
        ><span class="calc" class:err={!!seg.error}>{seg.error ? '⚠' : Math.round(seg.value)}</span>
        <svelte:fragment slot="tip">
          <div class="bd">
            <div class="mono expr">{seg.src}</div>
            {#if seg.error}
              <div class="err">{seg.error}</div>
            {:else}
              {#each seg.vars as v}
                <div class="line"><span class="muted">{v.name}</span><span class="mono">{v.value}</span></div>
              {/each}
              <div class="line total"><span>=</span><span class="mono">{Math.round(seg.value)}</span></div>
            {/if}
          </div>
        </svelte:fragment>
      </Tooltip>{:else}<Tooltip placement="top"
        ><span class="dmg-expr">{#each seg.parts as part, i}{#if i > 0}<span class="plus"> + </span>{/if}<span style={part.colour ? `color:${part.colour}` : ''}>{part.text}</span>{/each}</span>
        <svelte:fragment slot="tip"><div class="mono expr">{seg.src}</div></svelte:fragment>
      </Tooltip>{/if}{/each}</span
>

<style>
  .calc {
    color: var(--gold);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: help;
    border-bottom: 1px dotted var(--gold);
  }
  .calc.err {
    color: var(--bad);
    border-color: var(--bad);
  }
  .dmg-expr {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: help;
  }
  .plus {
    color: var(--text-dim);
  }
  .bd {
    min-width: 150px;
  }
  .expr {
    margin-bottom: 0.3rem;
    color: var(--text-dim);
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .total {
    border-top: 1px solid var(--border);
    margin-top: 3px;
    padding-top: 3px;
    font-weight: 600;
  }
  .err {
    color: var(--bad);
  }
</style>
