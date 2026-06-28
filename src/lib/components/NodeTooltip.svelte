<script lang="ts">
  import type { NodeView } from '../engine/tree';
  import type { FormulaContext } from '../engine/formula';
  import { evalFormula, extractVars } from '../engine/formula';
  import { ruleset } from '../stores';
  import RuleTag from './RuleTag.svelte';
  import FormulaText from './FormulaText.svelte';
  import Tooltip from './Tooltip.svelte';

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

  function evalAC(formula: string): string {
    const res = evalFormula(formula, ctx);
    return res.error ? formula : String(Math.round(res.value));
  }

  function grantText(g: NodeView['node']['grants'][number]): string {
    if (g.kind === 'resource') return `+${g.amount} ${resName(g.resourceId)}`;
    if (g.kind === 'modifier') return `${g.mode === 'set' ? 'set ' : g.mode === 'mul' ? '×' : g.value >= 0 ? '+' : ''}${g.value} ${g.target}`;
    if (g.kind === 'ac') {
      const modeLabel = (g.mode ?? 'set') === 'adjust' ? 'adj ' : '';
      return `${modeLabel}AC ${evalAC(g.low)} — ${evalAC(g.high)}`;
    }
    if (g.kind === 'scaling') return `${g.tag}: scales ${g.toHit || g.damage}`;
    if (g.kind === 'addmode') return `adds ${g.mode.name} mode to ${(g.weaponTags ?? (g.weaponTag ? [g.weaponTag] : [])).join(', ') || 'all weapons'}`;
    if (g.kind === 'attackmod') return `modifier: ${g.modifier.name}`;
    if (g.kind === 'actionext') return `extends ${g.actionTag}: ${[g.range && `range ${g.range}`, g.target && `target ${g.target}`].filter(Boolean).join(', ')}`;
    if (g.kind === 'dmgbonus') {
      const res = evalFormula(g.formula, ctx);
      const val = res.error ? g.formula : String(Math.round(res.value));
      const filters = [g.weaponTag && `tag:${g.weaponTag}`, g.attackName && `name:${g.attackName}`, g.attackType && `type:${g.attackType}`].filter(Boolean).join(' ');
      const hitPart = g.toHitBonus ? ` +${g.toHitBonus} hit` : '';
      return `+${val} dmg${hitPart}${filters ? ` (${filters})` : ' (all attacks)'}`;
    }
    return '';
  }

  function grantTooltip(g: NodeView['node']['grants'][number]): string | null {
    if (g.kind === 'ac') {
      const usedVars = [...new Set([...extractVars(g.low), ...extractVars(g.high)])];
      const lines: string[] = [`Formula: ${g.low} — ${g.high}`];
      for (const v of usedVars) if (v in ctx) lines.push(`  ${v} = ${ctx[v]}`);
      return lines.join('\n');
    }
    if (g.kind === 'dmgbonus') {
      const res = evalFormula(g.formula, ctx);
      if (res.error) return null;
      const allFormulas = [g.formula, g.toHitBonus].filter(Boolean);
      const usedVars = [...new Set(allFormulas.flatMap((f) => extractVars(f!)))];
      const lines = [`Dmg formula: ${g.formula}`];
      if (g.toHitBonus) lines.push(`Hit formula: ${g.toHitBonus}`);
      lines.push(...usedVars.filter((v) => v in ctx).map((v) => `  ${v} = ${ctx[v]}`));
      return lines.join('\n');
    }
    return null;
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
      <div class="grants">
        {#each node.grants as g (g.id)}
          {@const tip = grantTooltip(g)}
          {#if tip}
            <Tooltip placement="top">
              <span class="gbadge hoverable">{grantText(g)}</span>
              <svelte:fragment slot="tip"><pre class="gtip">{tip}</pre></svelte:fragment>
            </Tooltip>
          {:else}
            <span class="gbadge">{grantText(g)}</span>
          {/if}
        {/each}
      </div>
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
  .gbadge.hoverable { cursor: help; border-style: dashed; }
  .gtip { margin: 0; font-size: 0.82em; white-space: pre; }
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
