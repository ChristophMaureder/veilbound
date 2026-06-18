<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { OwnedAction } from '../selectors';
  import type { Derived } from '../engine/derive';
  import type { FormulaContext } from '../engine/formula';
  import { openTree, ruleset, activeCharacter, adjustResource } from '../stores';
  import RuleTag from './RuleTag.svelte';
  import FormulaText from './FormulaText.svelte';
  import Tooltip from './Tooltip.svelte';

  export let owned: OwnedAction;
  export let ctx: FormulaContext;
  export let derived: Derived;
  export let showDescription = true;
  export let showSource = false;  // show skill tree / item source name
  export let editing = false;     // tab is being edited — reveal the standard-action hide control
  export let hidden = false;      // this standard action is hidden for the character

  const dispatch = createEventDispatcher<{ toggleHide: void }>();
  $: showHideToggle = editing && owned.source === 'standard';

  $: a = owned.action;
  $: resDef = a.resource ? $ruleset.resources.find((r) => r.id === a.resource!.resourceId) : null;
  $: resCur = a.resource && $activeCharacter ? ($activeCharacter.resourceState[a.resource.resourceId] ?? 0) : 0;
  $: resMax = a.resource ? (derived.resourceById[a.resource.resourceId]?.max ?? 0) : 0;
  $: canUse = a.resource ? (a.resource.mode === 'consume' ? resCur >= a.resource.amount : resCur < resMax) : false;
  function useResource() {
    if (!a.resource || !canUse) return;
    adjustResource(a.resource.resourceId, a.resource.mode === 'consume' ? -a.resource.amount : a.resource.amount);
  }

  $: tw = a.weaponTarget ? derived.weaponBySlot[a.weaponTarget] : null;
  $: twMode = tw ? (a.weaponMode ? tw.modes.find((m) => m.name === a.weaponMode) ?? tw.modes[0] : tw.modes[0]) : null;
</script>

<div class="card" class:dimmed={hidden && editing} class:linked={!!owned.treeId}
  on:click={() => { if (owned.treeId) openTree(owned.treeId); }}>
  <div class="top">
    <strong class="nm">{a.name}</strong>
    {#if showHideToggle}
      <label class="hidechk" title="Hide this standard action for this character" on:click|stopPropagation>
        <input type="checkbox" checked={hidden} on:change={() => dispatch('toggleHide')} /> hide
      </label>
    {/if}
    <span class="cost" title="Action cost">{a.cost}</span>
  </div>

  <div class="badges">
    {#if a.resource && resDef}
      <span class="badge {a.resource.mode}">{a.resource.mode === 'consume' ? '−' : '+'}{a.resource.amount} {resDef.label}</span>
    {/if}
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

  {#if a.flavour && showDescription}<p class="flavour">{a.flavour}</p>{/if}
  {#if a.effect}<p class="effect"><FormulaText text={a.effect} {ctx} damageTypes={$ruleset.damageTypes} /></p>{/if}

  {#if showSource}<p class="src faint">{owned.sourceName}</p>{/if}

  {#if a.resource && resDef}
    <div class="use-row">
      <button class="usebtn {a.resource.mode}" on:click|stopPropagation={useResource} disabled={!canUse}
        title={a.resource.mode === 'consume' ? `Spend ${a.resource.amount} ${resDef.label} (${resCur}/${resMax})` : `Gain ${a.resource.amount} ${resDef.label} (${resCur}/${resMax})`}>
        {a.resource.mode === 'consume' ? 'Use' : 'Gain'}
      </button>
    </div>
  {/if}
</div>

<style>
  .card { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.35rem; transition: border-color 0.12s; }
  .card.linked { cursor: pointer; }
  .card.linked:hover { border-color: var(--accent-2); }
  .card.dimmed { opacity: 0.5; border-style: dashed; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .hidechk { font-size: 0.74em; color: var(--text-dim); display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer; }
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
  .src { font-size: 0.78em; margin: 0; }
  .use-row { margin-top: auto; padding-top: 0.3rem; display: flex; }
  .usebtn { font-size: 0.82em; font-weight: 600; padding: 0.25em 0.8em; border-radius: 999px; cursor: pointer; }
  .usebtn.consume { background: rgba(224,106,106,0.12); color: var(--bad); border: 1px solid #6b2d2d; }
  .usebtn.grant { background: rgba(94,201,138,0.12); color: var(--good); border: 1px solid #2d6b45; }
  .usebtn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
