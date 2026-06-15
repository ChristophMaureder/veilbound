<script lang="ts">
  import { slide } from 'svelte/transition';
  import { CORE_STATS, CORE_STAT_LABELS } from '../types';
  import type { CoreStat, Tier } from '../types';
  import {
    activeCharacter, ruleset as rulesetStore, derivedActive, rulesetChanged,
    updateActive, acknowledgeRuleset, grantSkillPoints,
  } from '../stores';
  import { applyRecovery } from '../engine/rest';
  import { clamp, downloadJSON, slug } from '../util';
  import { dur } from '../motion';

  import StatCard from './StatCard.svelte';
  import StatPopup from './StatPopup.svelte';
  import DotRow from './DotRow.svelte';
  import NumberAdjust from './NumberAdjust.svelte';
  import ResourcePanel from './ResourcePanel.svelte';
  import ActionsPanel from './ActionsPanel.svelte';
  import SkillsBox from './SkillsBox.svelte';
  import WeaponsBox from './WeaponsBox.svelte';

  $: character = $activeCharacter;
  $: ruleset = $rulesetStore;
  $: derived = $derivedActive;

  let hpPopup = false;
  let soulPopup = false;
  let acPopup = false;

  const TIER_RANK: Record<Tier, number> = { pri: 0, sec: 1, tert: 2, quat: 3 };
  $: orderedStats = character ? [...CORE_STATS].sort((a, b) => TIER_RANK[character!.statTiers[a]] - TIER_RANK[character!.statTiers[b]]) : [];

  function setLevel(v: number) { updateActive((c) => ({ ...c, level: clamp(Math.round(v), 1, ruleset.levelTable.length || 20) })); }
  function setCrit(v: number) { updateActive((c) => ({ ...c, crit: clamp(Math.round(v), -6, 6) })); }
  function setName(v: string) { updateActive((c) => ({ ...c, name: v })); }
  function setHp(v: number) { if (derived) updateActive((c) => ({ ...c, hpCurrent: clamp(v, 0, derived!.hpMax.effective) })); }
  function setSoul(v: number) { if (derived) updateActive((c) => ({ ...c, soulCurrent: clamp(v, 0, derived!.soulMax.effective) })); }

  function doRest(kind: 'short' | 'long') {
    if (!derived) return;
    const d = derived;
    updateActive((c) => {
      const hpAmt = kind === 'short' ? ruleset.hpShortRest : ruleset.hpLongRest;
      const hpCurrent = applyRecovery(c.hpCurrent, d.hpMax.effective, hpAmt);
      const resourceState = { ...c.resourceState };
      for (const r of d.resources) {
        const amt = kind === 'short' ? r.def.shortRest : r.def.longRest;
        resourceState[r.def.id] = applyRecovery(resourceState[r.def.id] ?? 0, r.max, amt);
      }
      return { ...c, hpCurrent, resourceState };
    });
  }
  function exportCharacter() { if (character) downloadJSON(`veilbound-${slug(character.name)}.json`, character); }
</script>

{#if !character || !derived}
  <div class="empty panel"><p class="muted">No character selected. Create or import one to begin.</p></div>
{:else}
  <div class="sheet">
    <div class="header panel">
      <div class="row wrap" style="align-items:flex-end">
        <div class="col" style="gap:2px"><label>Name</label><input class="name" value={character.name} on:input={(e) => setName(e.currentTarget.value)} /></div>
        <div class="col" style="gap:2px"><label>Level</label><input class="lvl" type="number" value={character.level} on:input={(e) => setLevel(Number(e.currentTarget.value))} /></div>
        <div class="col" style="gap:2px"><label>Crit Points</label><div class="crit-row"><button class="small" on:click={() => setCrit(character.crit - 1)}>−</button><span class="mono crit-val">{character.crit >= 0 ? '+' : ''}{character.crit}</span><button class="small" on:click={() => setCrit(character.crit + 1)}>+</button></div></div>
        <div class="col" style="gap:2px"><label>Proficiency</label><div class="prof mono">+{derived.prof}</div></div>
        <span class="spacer"></span>
        <div class="row"><button on:click={() => doRest('short')}>🌙 Short Rest</button><button on:click={() => doRest('long')}>☀️ Long Rest</button><button class="ghost" on:click={exportCharacter}>⬇ Export</button></div>
      </div>
      <div class="skillpts row">
        <span class="faint small">Skill points: <strong>{derived.skillRemaining}</strong> / {derived.skillTotal} (invested {derived.skillInvested})</span>
        <NumberAdjust subFirst on:add={(e) => grantSkillPoints(e.detail)} on:subtract={(e) => grantSkillPoints(-e.detail)} />
      </div>
    </div>

    {#if $rulesetChanged}<div class="badge-warn row" transition:slide={{ duration: dur(160) }}><span>⚠ The ruleset changed since you last opened this character.</span><span class="spacer"></span><button class="small" on:click={acknowledgeRuleset}>Dismiss</button></div>{/if}
    {#if derived.overBudget}<div class="badge-warn" transition:slide={{ duration: dur(160) }}>⚠ Over budget: {derived.skillInvested} invested but only {derived.skillTotal} granted. Unlearn some nodes.</div>{/if}

    <div class="topgrid">
      <!-- Left column: stats → AC → weapons -->
      <div class="leftcol">
        <section class="panel stats-panel">
          <h3>Core Stats</h3>
          <div class="stats">
            {#each orderedStats as s}
              <StatCard label={CORE_STAT_LABELS[s]} abbr={s} target={s} dv={derived.stats[s]} rank={TIER_RANK[character.statTiers[s]]} />
            {/each}
          </div>
        </section>
        <button class="ac panel" on:click={() => derived?.ac && (acPopup = true)}>
          <div class="aclabel">Armour Class</div>
          {#if derived.ac}<div class="acval">{derived.ac.low} — {derived.ac.high}</div><div class="faint small">{derived.ac.armourName}</div>
          {:else}<div class="acval faint">—</div><div class="faint small">no armour equipped</div>{/if}
        </button>
        <WeaponsBox {derived} />
      </div>

      <!-- Right column: HP → soul → resources -->
      <div class="rightcol">
        <section class="panel hp-panel">
          <div class="vrow"><button class="vlabel" on:click={() => (hpPopup = true)}>Hit Points</button><span class="spacer"></span><span class="mono big">{character.hpCurrent} <span class="faint">/ {derived.hpMax.effective}</span></span></div>
          <div class="bar"><div class="fill hp" style="width:{derived.hpMax.effective ? (character.hpCurrent / derived.hpMax.effective) * 100 : 0}%"></div></div>
          <NumberAdjust on:add={(e) => setHp(character.hpCurrent + e.detail)} on:subtract={(e) => setHp(character.hpCurrent - e.detail)} />
        </section>
        <section class="panel soul-panel">
          <div class="vrow"><button class="vlabel" on:click={() => (soulPopup = true)}>Soul</button><span class="spacer"></span></div>
          <DotRow value={character.soulCurrent} max={derived.soulMax.effective} colour="var(--soul)" size={28} on:change={(e) => setSoul(e.detail)} />
        </section>
        <section class="panel res-panel"><h3>Resources</h3><ResourcePanel {character} resources={derived.resources} /></section>
      </div>
    </div>

    <section class="panel"><h3>Actions</h3><ActionsPanel {character} ctx={derived.ctx} {derived} /></section>

    <section class="panel"><h3>Skills</h3><SkillsBox {character} {ruleset} /></section>
  </div>

  {#if hpPopup}<StatPopup label="Max HP" target="hpMax" dv={derived.hpMax} on:close={() => (hpPopup = false)} />{/if}
  {#if soulPopup}<StatPopup label="Max Soul" target="soulMax" dv={derived.soulMax} on:close={() => (soulPopup = false)} />{/if}
  {#if acPopup && derived.ac}<StatPopup label="Armour Class" target="ac" dv={{ base: 0, contributions: derived.ac.contributions, effective: 0 }} baseLabel={`${derived.ac.baseLow} — ${derived.ac.baseHigh}`} effectiveLabel={`${derived.ac.low} — ${derived.ac.high}`} on:close={() => (acPopup = false)} />{/if}
{/if}

<style>
  .sheet { display: flex; flex-direction: column; gap: 1rem; }
  .header .name { font-size: 1.2em; font-weight: 650; min-width: 200px; }
  .lvl { width: 70px; text-align: center; }
  .prof { font-size: 1.3em; font-weight: 700; padding: 0.1em 0.4em; }
  .skillpts { margin-top: 0.6rem; gap: 0.8rem; align-items: center; flex-wrap: wrap; }
  .small { font-size: 0.85em; }
  .topgrid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem; align-items: start; }
  .leftcol, .rightcol { display: flex; flex-direction: column; gap: 1rem; }
  .stats-panel { display: flex; flex-direction: column; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .ac { text-align: center; cursor: pointer; display: flex; flex-direction: column; gap: 0.2rem; align-items: center; border: 2px solid var(--accent); }
  .ac:hover { border-color: var(--accent-2); }
  .aclabel { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
  .acval { font-size: 2.2em; font-weight: 800; font-variant-numeric: tabular-nums; }
  .vrow { display: flex; align-items: baseline; margin-bottom: 0.35rem; }
  .vlabel { font-weight: 600; background: transparent; border: none; padding: 0; color: var(--text); cursor: pointer; }
  .vlabel:hover { color: var(--accent); }
  .big { font-size: 1.2em; }
  .bar { height: 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; margin-bottom: 0.5rem; }
  .fill { height: 100%; transition: width 0.25s ease; }
  .fill.hp { background: linear-gradient(90deg, var(--bad), #e0a06a); }
  .soul-panel :global(.dots) { gap: 8px; }
  .crit-row { display: flex; align-items: center; gap: 0.3rem; }
  .crit-val { font-size: 1.1em; font-weight: 700; min-width: 2.5ch; text-align: center; }
  .empty { text-align: center; padding: 3rem; }
  .badge-warn { background: rgba(224,160,60,0.12); border: 1px solid #8a6520; border-radius: var(--radius-sm); padding: 0.5rem 0.8rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9em; }
  @media (max-width: 720px) { .topgrid { grid-template-columns: 1fr; } }
</style>
