<script lang="ts">
  import type { OwnedAction } from '../selectors';
  import type { Derived } from '../engine/derive';
  import type { FormulaContext } from '../engine/formula';
  import { openTree, ruleset } from '../stores';
  import RuleTag from './RuleTag.svelte';
  import FormulaText from './FormulaText.svelte';
  import Tooltip from './Tooltip.svelte';

  export let owned: OwnedAction;
  export let ctx: FormulaContext;
  export let derived: Derived;
  export let showDescription = true;

  $: a = owned.action;
  $: resDef = a.resource ? $ruleset.resources.find((r) => r.id === a.resource!.resourceId) : null;

  // If the action targets a weapon slot, show that weapon's live numbers (§3).
  $: tw = a.weaponTarget ? derived.weaponBySlot[a.weaponTarget] : null;
  $: twMode = tw ? (a.weaponMode ? tw.modes.find((m) => m.name === a.weaponMode) ?? tw.modes[0] : tw.modes[0]) : null;
</script>

<div class="card">
  <div class="top">
    <strong class="nm">{a.name}</strong>
    <span class="cost" title="Action cost">{a.cost}</span>
  </div>

  <div class="badges">
    {#if a.resource && resDef}<span class="badge {a.resource.mode}">{a.resource.mode === 'consume' ? '−' : '+'}{a.resource.amount} {resDef.label}</span>{/if}
    {#each a.ruleTags as t}<RuleTag tag={t} />{/each}
  </div>

  {#if a.weaponTarget}
    <div class="wline">
      <span class="wslot">{a.weaponTarget === 'main' ? 'Main' : 'Secondary'} weapon{#if twMode} ({twMode.name}){/if}:</span>
      {#if twMode}
        <span class="tohit">+{twMode.toHit} to hit</span> ·
        <span class="dmg">{#each twMode.damage as term, i}{#if i > 0}<span class="plus"> + </span>{/if}<Tooltip placement="top"><span class="term" style="color:{term.colour}">{term.notation}</span><svelte:fragment slot="tip"><span>{term.typeName}</span></svelte:fragment></Tooltip>{/each}</span>
      {:else}<span class="faint">no weapon in slot</span>{/if}
    </div>
  {/if}

  {#if showDescription}
    {#if a.flavour}<p class="flavour">{a.flavour}</p>{/if}
    {#if a.effect}<p class="effect"><FormulaText text={a.effect} {ctx} damageTypes={$ruleset.damageTypes} /></p>{/if}
  {/if}

  <div class="foot">
    <span class="src faint">{owned.sourceName}</span>
    {#if owned.treeId}<button class="ghost small" on:click={() => owned.treeId && openTree(owned.treeId)}>Node view →</button>{/if}
  </div>
</div>

<style>
  .card { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .nm { font-size: 1.02em; }
  .cost { font-size: 0.78em; background: rgba(124,95,212,0.18); border: 1px solid var(--accent); border-radius: 999px; padding: 0.1em 0.55em; white-space: nowrap; color: var(--accent); font-weight: 600; }
  .badges { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }
  .badge { font-size: 0.76em; padding: 0.1em 0.5em; border-radius: 999px; font-weight: 600; }
  .badge.consume { background: rgba(224,106,106,0.18); color: var(--bad); border: 1px solid #6b2d2d; }
  .badge.grant { background: rgba(94,201,138,0.18); color: var(--good); border: 1px solid #2d6b45; }
  .wline { font-size: 0.85em; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.25rem 0.45rem; }
  .wslot { color: var(--text-dim); }
  .tohit, .dmg { font-weight: 600; font-variant-numeric: tabular-nums; }
  .term { cursor: help; }
  .plus { color: var(--text-dim); }
  .flavour { font-style: italic; color: var(--text-dim); margin: 0; font-size: 0.88em; }
  .effect { margin: 0; font-size: 0.9em; }
  .foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
  .src { font-size: 0.8em; }
</style>
