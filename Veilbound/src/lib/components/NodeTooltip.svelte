<script lang="ts">
  import type { NodeView } from '../engine/tree';
  import type { FormulaContext } from '../engine/formula';
  import { ruleset } from '../stores';
  import RuleTag from './RuleTag.svelte';
  import FormulaText from './FormulaText.svelte';

  export let view: NodeView;
  export let revealed: boolean;
  export let ctx: FormulaContext;

  $: node = view.node;
  $: hideName = node.hideName && !revealed;
  $: hideDesc = node.hideDescription && !revealed;
  $: hidePrereq = node.hidePrerequisite && !revealed;
  $: displayName = hideName ? '???' : node.name || node.actions[0]?.name || 'Skill';

  function resName(id: string): string {
    return $ruleset.resources.find((r) => r.id === id)?.label ?? id;
  }
  function grantText(g: NodeView['node']['grants'][number]): string {
    if (g.kind === 'resource') return `+${g.amount} ${resName(g.resourceId)}`;
    if (g.kind === 'modifier') return `${g.mode === 'set' ? 'set ' : g.mode === 'mul' ? '×' : g.value >= 0 ? '+' : ''}${g.value} ${g.target}`;
    if (g.kind === 'ac') return `Armour Class ${g.low} — ${g.high}`;
    if (g.kind === 'scaling') return `${g.tag}: scales ${g.toHit || g.damage}`;
    return `+${g.formula} ${g.scopeValue} damage (${g.scope})`;
  }
</script>

<div class="nt">
  <div class="head">
    <strong>{displayName}</strong>
    <span class="status">
      {#if view.owned}<span class="s owned">owned</span>
      {:else if view.locked}<span class="s locked">locked</span>
      {:else if view.available}<span class="s avail">available</span>
      {:else}<span class="s">unreached</span>{/if}
    </span>
  </div>
  <div class="cost faint">Cost: {node.cost}{#if view.invested > 0 && !view.owned} · {view.invested}/{node.cost} invested{/if}</div>

  {#if !hideDesc}
    {#if node.description}<p class="desc">{node.description}</p>{/if}
    {#if node.grants.length}
      <div class="grants">{#each node.grants as g (g.id)}<span class="gbadge">{grantText(g)}</span>{/each}</div>
    {/if}
    {#each node.actions as a (a.id)}
      <div class="action">
        <div class="arow"><strong>{a.name}</strong><span class="acost">{a.cost}</span></div>
        <div class="badges">
          {#if a.resource}<span class="rbadge {a.resource.mode}">{a.resource.mode === 'consume' ? '−' : '+'}{a.resource.amount} {resName(a.resource.resourceId)}</span>{/if}
          {#each a.ruleTags as t}<RuleTag tag={t} />{/each}
        </div>
        {#if a.flavour}<div class="aflavour">{a.flavour}</div>{/if}
        {#if a.effect}<div class="aeffect"><FormulaText text={a.effect} {ctx} damageTypes={$ruleset.damageTypes} /></div>{/if}
      </div>
    {/each}
  {:else if !hideName}
    <p class="muted" style="margin:.3rem 0 0">Details hidden by your GM.</p>
  {/if}

  {#if !hidePrereq && node.prerequisite}
    <div class="prereq"><span class="faint">Prerequisite:</span> {node.prerequisite}</div>
  {/if}
</div>

<style>
  .nt { max-width: 290px; }
  .head { display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline; }
  .s { font-size: 0.72em; padding: 0.05em 0.45em; border-radius: 999px; background: var(--bg-3); color: var(--text-dim); }
  .s.owned { background: rgba(94,201,138,0.2); color: var(--good); }
  .s.avail { background: rgba(124,95,212,0.25); color: var(--accent); }
  .s.locked { background: rgba(224,106,106,0.18); color: var(--bad); }
  .cost { font-size: 0.82em; }
  .desc { margin: 0.4rem 0 0.3rem; font-size: 0.9em; }
  .grants { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.3rem; }
  .gbadge { font-size: 0.74em; padding: 0.1em 0.5em; border-radius: 999px; background: rgba(94,201,138,0.15); color: var(--good); border: 1px solid #2d6b45; }
  .action { border-top: 1px solid var(--border); margin-top: 0.45rem; padding-top: 0.4rem; }
  .arow { display: flex; justify-content: space-between; gap: 0.5rem; }
  .acost { font-size: 0.78em; color: var(--text-dim); background: var(--bg-3); border-radius: 999px; padding: 0 0.5em; white-space: nowrap; }
  .badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.25rem 0; align-items: center; }
  .rbadge { font-size: 0.74em; padding: 0.1em 0.5em; border-radius: 999px; font-weight: 600; }
  .rbadge.consume { background: rgba(224,106,106,0.18); color: var(--bad); border: 1px solid #6b2d2d; }
  .rbadge.grant { background: rgba(94,201,138,0.18); color: var(--good); border: 1px solid #2d6b45; }
  .aflavour { font-style: italic; color: var(--text-dim); font-size: 0.86em; margin-top: 0.15rem; }
  .aeffect { font-size: 0.88em; margin-top: 0.15rem; }
  .prereq { margin-top: 0.4rem; font-size: 0.84em; }
</style>
