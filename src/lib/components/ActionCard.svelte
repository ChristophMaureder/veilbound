<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { OwnedAction } from '../selectors';
  import { ownedModifiers, applicableModifiers } from '../selectors';
  import type { Derived } from '../engine/derive';
  import { composeAttack } from '../engine/derive';
  import type { FormulaContext } from '../engine/formula';
  import { evalInt } from '../engine/formula';
  import type { ActionResourceUse } from '../types';
  import { openTree, ruleset, activeCharacter, adjustResource } from '../stores';
  import RuleTag from './RuleTag.svelte';
  import FormulaText from './FormulaText.svelte';
  import Tooltip from './Tooltip.svelte';

  export let owned: OwnedAction;
  export let ctx: FormulaContext;
  export let derived: Derived;
  export let showDescription = true;
  export let showSource = false;
  export let editing = false;
  export let hidden = false;

  const dispatch = createEventDispatcher<{ toggleHide: void }>();
  $: showHideToggle = editing && owned.source === 'standard';
  $: a = owned.action;

  $: tw = a.weaponTarget ? derived.weaponBySlot[a.weaponTarget] : null;
  $: twMode = tw ? (a.weaponMode ? tw.modes.find((m) => m.name === a.weaponMode) ?? tw.modes[0] : tw.modes[0]) : null;
  $: weaponRefs = {
    main: derived.weaponBySlot.main?.modes[0]?.damage,
    side: derived.weaponBySlot.secondary?.modes[0]?.damage,
  };

  $: ownedMods = $activeCharacter ? ownedModifiers($activeCharacter, $ruleset) : [];
  $: mods = applicableModifiers(a, twMode, ownedMods);
  // Radio modifiers (maneuvers — one at a time)
  $: radioMods = mods.filter((m) => !m.modifier.stackable);
  // Stackable layers (spell layers — multi-select)
  $: layerMods = mods.filter((m) => !!m.modifier.stackable);
  // Replacement chain: hide modifiers that are superseded by a higher-tier modifier
  $: replacedIds = new Set(layerMods.map((m) => m.modifier.replacesModifierId).filter((id): id is string => !!id));
  $: visibleLayerMods = layerMods.filter((m) => !replacedIds.has(m.modifier.id));

  let activeModifierId: string | null = null;
  let activeLayerIds: Set<string> = new Set();
  let layerManaSpend: Record<string, number> = {};
  let pickerOpen = false;

  $: if (activeModifierId && !radioMods.some((m) => m.modifier.id === activeModifierId)) activeModifierId = null;
  $: activeMod = radioMods.find((m) => m.modifier.id === activeModifierId)?.modifier ?? null;
  // Active layers exclude any that are replaced by an available higher-tier modifier
  $: activeLayers = layerMods.filter((m) => activeLayerIds.has(m.modifier.id) && !replacedIds.has(m.modifier.id)).map((m) => m.modifier);

  function selectMod(id: string) {
    activeModifierId = activeModifierId === id ? null : id;
    pickerOpen = false;
  }
  function clearMod(e: MouseEvent) {
    e.stopPropagation();
    activeModifierId = null;
  }
  function toggleLayer(id: string) {
    const next = new Set(activeLayerIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    activeLayerIds = next;
  }
  function setLayerMana(id: string, n: number, max: number | undefined) {
    layerManaSpend = { ...layerManaSpend, [id]: Math.max(1, max != null ? Math.min(n, max) : n) };
  }

  $: activeModifiers = [...(activeMod ? [activeMod] : []), ...activeLayers];
  $: composedBase = twMode ? composeAttack(twMode, a, activeModifiers, ctx, $ruleset.damageTypes, weaponRefs) : null;
  $: composed = composedBase && extToHitBonus
    ? { ...composedBase, toHit: composedBase.toHit + extToHitBonus, modified: composedBase.modified || extToHitBonus !== 0 }
    : composedBase;

  $: resourceUses = (() => {
    const result: ActionResourceUse[] = [];
    for (const r of a.resources ?? []) result.push(r);
    for (const m of activeModifiers) {
      if (!m.resource) continue;
      if (m.spellTargetsPerMana != null || m.spellDmgPerMana != null || m.spellRangePerMana != null) {
        const chosen = layerManaSpend[m.id] ?? 1;
        result.push({ ...m.resource, amount: chosen });
      } else {
        result.push(m.resource);
      }
    }
    return result;
  })();
  function resDefOf(id: string) { return $ruleset.resources.find((r) => r.id === id) ?? null; }
  // Combine same-resource + same-mode entries so the badge row shows one total per resource
  $: displayResourceUses = (() => {
    const map = new Map<string, ActionResourceUse>();
    for (const u of resourceUses) {
      const key = `${u.resourceId}:${u.mode}`;
      const ex = map.get(key);
      map.set(key, ex ? { ...ex, amount: ex.amount + u.amount } : { ...u });
    }
    return [...map.values()];
  })();
  $: hasConsume = resourceUses.some((u) => u.mode === 'consume');
  $: canUseAll = (() => {
    if (!resourceUses.length) return true;
    const net = new Map<string, number>();
    for (const u of resourceUses) net.set(u.resourceId, (net.get(u.resourceId) ?? 0) + (u.mode === 'consume' ? -u.amount : u.amount));
    for (const [id, delta] of net) {
      const cur = $activeCharacter?.resourceState[id] ?? 0;
      const max = derived.resourceById[id]?.max ?? 0;
      if (delta < 0 && cur + delta < 0) return false;
      if (delta > 0 && cur >= max) return false;
    }
    return true;
  })();
  function useAction() {
    if (!canUseAll) return;
    for (const u of resourceUses) adjustResource(u.resourceId, u.mode === 'consume' ? -u.amount : u.amount);
    activeModifierId = null;
    activeLayerIds = new Set();
    layerManaSpend = {};
  }

  $: allRuleTags = [
    ...a.ruleTags,
    ...activeModifiers.flatMap((m) => m.addRuleTags),
  ];

  // actionext grants matching by tag OR action name OR attack type (any filter set = OR logic)
  $: extGrants = derived.actionExts.filter((e) => {
    const tagMatch = e.actionTag && a.ruleTags.some((t) => t.toLowerCase() === e.actionTag.toLowerCase());
    const nameMatch = e.actionName && e.actionName.split(';').some((n) => n.trim().toLowerCase() === a.name.toLowerCase());
    const typeMatch = e.attackType && twMode?.attackType?.toLowerCase() === e.attackType.toLowerCase();
    return tagMatch || nameMatch || typeMatch;
  });
  $: extRanges = extGrants.map((e) => e.range).filter((r): r is string => !!r);
  $: extTargets = extGrants.map((e) => e.target).filter((t): t is string => !!t);

  // Spell card computed values
  function parseRangeFt(s: string | undefined): number | null {
    if (!s) return null;
    const m = /^(\d+)\s*(?:ft|feet)/i.exec(s.trim());
    return m ? parseInt(m[1]) : null;
  }
  function parseTargetCount(s: string | undefined): number | null {
    if (!s) return null;
    const m = /^(\d+)/.exec(s.trim());
    return m ? parseInt(m[1]) : null;
  }

  // Permanent to-hit bonus from actionext grants
  $: extToHitBonus = extGrants.reduce((sum, e) => sum + (e.toHitBonus ? evalInt(e.toHitBonus, ctx) : 0), 0);

  // Permanent range: base action range + sum of numeric rangeAdd from actionext grants
  $: permanentRangeAdd = extGrants.reduce((sum, e) => sum + (e.rangeAdd ?? 0), 0);
  $: permanentRange = (() => {
    if (!permanentRangeAdd) return a.range;
    const num = parseRangeFt(a.range);
    return num != null ? `${num + permanentRangeAdd} ft` : a.range;
  })();

  // Permanent dmg adds from actionext grants (always shown on spell card)
  $: permanentDmgAdds = extGrants.map((e) => e.dmgAdd).filter((s): s is string => !!s);

  // Layer-modified range (on top of permanent range)
  $: modifiedRange = (() => {
    const base = permanentRange;
    if (!a.isSpell || !activeLayers.length) return base;
    let result = base;
    for (const lm of activeLayers) {
      if (lm.spellRangeOverride) { result = lm.spellRangeOverride; break; }
      if (lm.spellRangeAdd != null) {
        const num = parseRangeFt(result);
        if (num != null) result = `${num + lm.spellRangeAdd} ft`;
      }
      if (lm.spellRangePerMana != null) {
        const chosen = layerManaSpend[lm.id] ?? 1;
        const num = parseRangeFt(result);
        if (num != null) result = `${num + chosen * lm.spellRangePerMana} ft`;
      }
    }
    return result;
  })();

  // Layer-modified target (accounts for variable-mana layers)
  $: modifiedTarget = (() => {
    if (!a.isSpell || !activeLayers.length) return a.target;
    let result: string | undefined = a.target;
    for (const lm of activeLayers) {
      if (lm.spellTargetsOverride) { result = lm.spellTargetsOverride; break; }
      if (lm.spellTargetsPerMana != null) {
        const chosen = layerManaSpend[lm.id] ?? 1;
        const extra = chosen * lm.spellTargetsPerMana;
        const base = result ?? '';
        const num = parseTargetCount(base);
        result = num != null ? base.replace(/^\d+/, String(num + extra)) : `+${extra}`;
      } else if (lm.spellTargetsAdd != null) {
        const base = result ?? '';
        const num = parseTargetCount(base);
        if (num != null) result = base.replace(/^\d+/, String(num + lm.spellTargetsAdd));
      }
    }
    return result;
  })();

  $: rangeModified = modifiedRange !== permanentRange;
  $: targetModified = modifiedTarget !== a.target;
  // All damage adds: permanent (from owned nodes) + layer-based (from active spell layers)
  $: spellDamageAdds = activeLayers.flatMap((lm) => {
    const adds: string[] = [];
    if (lm.spellDamageAdd) adds.push(lm.spellDamageAdd);
    if (lm.spellDmgPerMana) {
      const chosen = layerManaSpend[lm.id] ?? 1;
      for (let i = 0; i < chosen; i++) adds.push(lm.spellDmgPerMana);
    }
    return adds;
  });
  // Inject only active-layer adds into the last {{ }} formula block in the effect text
  function injectDmgAdds(effect: string, adds: string[]): string {
    if (!adds.length || !effect) return effect;
    const addExprs = adds.map((s) => s.replace(/^\+\s*/, '').trim()).filter(Boolean);
    const addStr = ' + ' + addExprs.join(' + ');
    let lastStart = -1;
    let lastEnd = -1;
    const re = /\{\{[^}]*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(effect)) !== null) { lastStart = m.index; lastEnd = m.index + m[0].length; }
    if (lastStart === -1) return effect;
    const inner = effect.slice(lastStart + 2, lastEnd - 2);
    return effect.slice(0, lastStart) + '{{' + inner + addStr + '}}' + effect.slice(lastEnd);
  }
  $: allDmgAdds = [...permanentDmgAdds, ...spellDamageAdds];
  $: displayEffect = allDmgAdds.length ? injectDmgAdds(a.effect, allDmgAdds) : a.effect;
  // Fallback: if the effect has no {{ }} block, show adds as badges below the text
  $: fallbackAdds = allDmgAdds.length && a.effect && !a.effect.includes('{{') ? allDmgAdds : [];

  // Action cost symbols
  function costSymbol(cost: string): string {
    const c = cost.trim().toLowerCase();
    if (c === 'reaction' || c === 'react') return '↻';
    if (c === 'free' || c === 'free action') return '○';
    const m = /^(\d+)\s*action/.exec(c);
    if (m) {
      const n = parseInt(m[1]);
      return n <= 4 ? '◆'.repeat(n) : `◆×${n}`;
    }
    return cost;
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
{#if pickerOpen}
  <div class="backdrop" on:click|stopPropagation={() => (pickerOpen = false)}></div>
{/if}

<div class="card" class:dimmed={hidden && editing} class:linked={!!owned.treeId}
  on:click={() => { if (owned.treeId) openTree(owned.treeId); }}>

  <!-- Name + cost -->
  <div class="header">
    <strong class="name">{a.name}</strong>
    {#if showHideToggle}
      <label class="hidechk" on:click|stopPropagation>
        <input type="checkbox" checked={hidden} on:change={() => dispatch('toggleHide')} /> hide
      </label>
    {/if}
    <span class="cost-pill" title={a.cost}>{costSymbol(a.cost)}</span>
    {#if a.isSpell}<span class="spell-pill">✦ Spell</span>{/if}
  </div>

  <!-- Spell stats bar (spell cards) — replaces meta-row for spells -->
  {#if a.isSpell && (a.range || a.reach || a.target || extRanges.length || extTargets.length || extToHitBonus)}
    <div class="spell-stats">
      {#if a.reach}
        <div class="spell-stat">
          <span class="spell-stat-lbl">Reach</span>
          <span class="spell-stat-val">{a.reach}</span>
        </div>
      {/if}
      {#if extToHitBonus}
        <div class="spell-stat">
          <span class="spell-stat-lbl">To Hit</span>
          <span class="spell-stat-val spell-modified">{extToHitBonus >= 0 ? '+' : ''}{extToHitBonus}</span>
        </div>
      {/if}
      {#if a.range || extRanges.length}
        <div class="spell-stat">
          <span class="spell-stat-lbl">Range</span>
          <span class="spell-stat-val" class:spell-modified={rangeModified}>
            {modifiedRange ?? a.range ?? '—'}{#if !rangeModified}{#each extRanges as r} <span class="meta-ext">+{r}</span>{/each}{/if}
          </span>
        </div>
      {/if}
      {#if a.target || extTargets.length}
        <div class="spell-stat">
          <span class="spell-stat-lbl">Target</span>
          <span class="spell-stat-val" class:spell-modified={targetModified}>
            {modifiedTarget ?? a.target ?? '—'}{#if !targetModified}{#each extTargets as t} <span class="meta-ext">+{t}</span>{/each}{/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Range / Reach / Target meta row (non-spell cards only) -->
  {#if !a.isSpell && (a.range || a.reach || a.target || extRanges.length || extTargets.length)}
    <div class="meta-row">
      {#if a.reach}
        <span class="meta-item"><span class="meta-lbl">Reach</span><span class="meta-val">{a.reach}</span></span>
      {/if}
      {#if a.range || extRanges.length}
        <span class="meta-item">
          <span class="meta-lbl">Range</span>
          {#if a.range}<span class="meta-val">{a.range}</span>{/if}
          {#each extRanges as r}<span class="meta-ext">+{r}</span>{/each}
        </span>
      {/if}
      {#if a.target || extTargets.length}
        <span class="meta-item">
          <span class="meta-lbl">Target</span>
          {#if a.target}<span class="meta-val">{a.target}</span>{/if}
          {#each extTargets as t}<span class="meta-ext">+{t}</span>{/each}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Attack stats -->
  {#if a.weaponTarget && a.showWeaponInfo !== false}
    <div class="attack-box" class:glowing={composed?.modified}>
      {#if twMode && composed}
        <span class="to-hit" class:modified={composed.modified}>+{composed.toHit}</span>
        <span class="atk-sep">·</span>
        <span class="damage">
          {#if composed.modified}
            {#each composed.parts as p, i}
              {#if i > 0}<span class="plus"> + </span>{/if}
              <span style="color:{p.colour ?? 'var(--text)'}">{p.text}</span>
            {/each}
          {:else}
            {#each twMode.damage as term, i}
              {#if i > 0}<span class="plus"> + </span>{/if}
              <Tooltip placement="top">
                <span class="dmg-term" style="color:{term.colour}">{term.notation}</span>
                <svelte:fragment slot="tip"><span>{term.typeName}</span></svelte:fragment>
              </Tooltip>
            {/each}
          {/if}
        </span>
      {:else}
        <span class="no-weapon">no weapon equipped</span>
      {/if}
    </div>
  {/if}

  <!-- Radio modifier selector (maneuvers — pick one) -->
  {#if radioMods.length}
    <div class="mod-anchor" on:click|stopPropagation>
      <button
        class="mod-trigger"
        class:active={!!activeMod}
        on:click={() => (pickerOpen = !pickerOpen)}
        title={activeMod ? 'Change or remove modifier' : 'Add a modifier to this action'}
      >
        {#if activeMod}
          <span class="dot filled"></span>
          <span class="trig-name">{activeMod.name}</span>
          <span class="trig-chevron">▾</span>
          <span class="trig-clear" on:click={clearMod} title="Remove modifier">✕</span>
        {:else}
          <span class="dot"></span>
          <span class="trig-placeholder">Add modifier</span>
          <span class="trig-chevron">▾</span>
        {/if}
      </button>

      {#if pickerOpen}
        <div class="picker" role="listbox">
          {#if activeMod}
            <button class="pick-row clear-row" on:click={() => { activeModifierId = null; pickerOpen = false; }}>
              <span class="pick-dot"></span>
              <span class="pick-label">None</span>
            </button>
            <div class="pick-divider"></div>
          {/if}
          {#each radioMods as om (om.modifier.id)}
            {@const modRes = om.modifier.resource}
            {@const modRd = modRes ? resDefOf(modRes.resourceId) : null}
            <button
              class="pick-row"
              class:selected={activeModifierId === om.modifier.id}
              on:click={() => selectMod(om.modifier.id)}
              role="option"
              aria-selected={activeModifierId === om.modifier.id}
            >
              <span class="pick-dot" class:on={activeModifierId === om.modifier.id}></span>
              <span class="pick-body">
                <span class="pick-name">{om.modifier.name}</span>
                {#if om.modifier.effect || om.modifier.flavour}
                  <span class="pick-hint">{om.modifier.effect || om.modifier.flavour}</span>
                {/if}
              </span>
              {#if modRes && modRd}
                <span class="pick-cost {modRes.mode}">
                  {modRes.mode === 'consume' ? '−' : '+'}{modRes.amount} {modRd.label}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Spell layers (stackable — toggle multiple) -->
  {#if visibleLayerMods.length}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="layers-row" on:click|stopPropagation>
      <span class="layers-lbl">Layers</span>
      {#each visibleLayerMods as om (om.modifier.id)}
        {@const isOn = activeLayerIds.has(om.modifier.id)}
        {@const lr = om.modifier.resource}
        {@const lrd = lr ? resDefOf(lr.resourceId) : null}
        {@const hasVar = !!(om.modifier.spellTargetsPerMana ?? om.modifier.spellDmgPerMana ?? om.modifier.spellRangePerMana)}
        {@const chosenMana = hasVar ? (layerManaSpend[om.modifier.id] ?? 1) : 1}
        {@const manaMax = om.modifier.spellManaMax}
        <button
          class="layer-btn"
          class:on={isOn}
          on:click={() => toggleLayer(om.modifier.id)}
          title={om.modifier.effect || om.modifier.flavour || om.modifier.name}
        >
          {om.modifier.name}
          {#if lr && lrd}
            <span class="layer-cost {lr.mode}">{lr.mode === 'consume' ? '−' : '+'}{hasVar && isOn ? chosenMana : lr.amount}</span>
          {/if}
        </button>
        {#if isOn && hasVar}
          {@const tgtPart = om.modifier.spellTargetsPerMana ? `+${chosenMana * om.modifier.spellTargetsPerMana} tgt` : null}
          {@const dmgPart = om.modifier.spellDmgPerMana ? `${chosenMana}×${om.modifier.spellDmgPerMana}` : null}
          {@const rngPart = om.modifier.spellRangePerMana ? `+${chosenMana * om.modifier.spellRangePerMana} ft` : null}
          {@const effectDesc = [tgtPart, dmgPart, rngPart].filter(Boolean).join(', ')}
          <span class="mana-pick">
            <button class="mana-adj" on:click|stopPropagation={() => setLayerMana(om.modifier.id, chosenMana - 1, manaMax)} disabled={chosenMana <= 1}>−</button>
            <span class="mana-val">{chosenMana}× → {effectDesc}</span>
            <button class="mana-adj" on:click|stopPropagation={() => setLayerMana(om.modifier.id, chosenMana + 1, manaMax)} disabled={manaMax != null && chosenMana >= manaMax}>+</button>
          </span>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Condition tags -->
  {#if allRuleTags.length}
    <div class="tags">
      {#each a.ruleTags as t}<RuleTag tag={t} />{/each}
      {#each activeModifiers.flatMap((m) => m.addRuleTags) as t}<RuleTag tag={t} added />{/each}
    </div>
  {/if}

  <!-- Effects -->
  {#if (a.flavour && showDescription) || a.effect || activeModifiers.some((m) => m.effect)}
    <div class="desc">
      {#if a.flavour && showDescription}<p class="flavour">{a.flavour}</p>{/if}
      {#if displayEffect}<p class="effect"><FormulaText text={displayEffect} {ctx} damageTypes={$ruleset.damageTypes} {weaponRefs} /></p>{/if}
      {#each fallbackAdds as dmgAdd}
        <div class="spell-dmg-add">
          <span class="spell-dmg-add-plus">+</span>
          <span class="spell-dmg-add-val">{dmgAdd}</span>
        </div>
      {/each}
      {#each activeModifiers as m}
        {#if m.effect}
          <div class="mod-effect">
            <p><FormulaText text={m.effect} {ctx} damageTypes={$ruleset.damageTypes} {weaponRefs} /></p>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if showSource}<p class="source">{owned.sourceName}</p>{/if}

  <!-- Use row -->
  {#if resourceUses.length || activeModifiers.length}
    <div class="use-row">
      <div class="costs">
        {#each displayResourceUses as u}
          {@const rd = resDefOf(u.resourceId)}
          {#if rd}<span class="cost-badge {u.mode}">{u.mode === 'consume' ? '−' : '+'}{u.amount} {rd.label}</span>{/if}
        {/each}
      </div>
      <button class="use-btn {!resourceUses.length ? 'neutral' : hasConsume ? 'consume' : 'grant'}"
        on:click|stopPropagation={useAction} disabled={!canUseAll}>
        {!resourceUses.length || hasConsume ? 'Use' : 'Gain'}
      </button>
    </div>
  {/if}
</div>

<style>
  /* Backdrop closes picker on outside click */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
  }

  .card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.8rem 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    transition: border-color 0.12s;
    position: relative; /* anchor for picker */
  }
  .card.linked { cursor: pointer; }
  .card.linked:hover { border-color: var(--accent-2); }
  .card.dimmed { opacity: 0.45; border-style: dashed; }

  /* Header */
  .header { display: flex; align-items: baseline; gap: 0.55rem; }
  .name { flex: 1; font-size: 1.08em; }
  .hidechk { font-size: 0.74em; color: var(--text-dim); display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer; }
  .cost-pill {
    font-size: 0.82em;
    background: rgba(124,95,212,0.14);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0.1em 0.55em;
    white-space: nowrap;
    color: var(--accent);
    font-weight: 600;
    flex-shrink: 0;
    letter-spacing: 0.04em;
    cursor: default;
    min-width: 1.6em;
    text-align: center;
  }

  /* Range / Target meta row */
  .meta-row { display: flex; gap: 1rem; flex-wrap: wrap; }
  .meta-item { display: flex; align-items: baseline; gap: 0.3rem; font-size: 0.82em; }
  .meta-lbl { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.78em; color: var(--text-faint); font-weight: 600; }
  .meta-val { color: var(--text-dim); }
  .meta-ext { color: var(--accent-2); font-style: italic; }

  /* Attack box */
  .attack-box {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border-2);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.65rem;
    transition: border-left-color 0.15s;
  }
  .attack-box.glowing { border-left-color: var(--accent); background: rgba(124,95,212,0.04); }
  .to-hit { font-size: 1.15em; font-weight: 700; color: var(--accent-2); font-variant-numeric: tabular-nums; }
  .to-hit.modified { color: var(--accent); text-shadow: 0 0 10px rgba(124,95,212,0.5); }
  .atk-sep { color: var(--text-faint); font-size: 0.9em; }
  .damage { font-size: 1em; font-weight: 600; font-variant-numeric: tabular-nums; }
  .dmg-term { cursor: help; }
  .plus { color: var(--text-dim); font-weight: 400; }
  .no-weapon { font-size: 0.85em; color: var(--text-faint); font-weight: 400; }

  /* Modifier trigger + picker */
  .mod-anchor { position: relative; }

  .mod-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.84em;
    padding: 0.28em 0.65em;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-2);
    background: var(--bg);
    color: var(--text-dim);
    cursor: pointer;
    width: 100%;
    transition: border-color 0.1s, color 0.1s;
  }
  .mod-trigger:hover { border-color: var(--accent-2); color: var(--text); }
  .mod-trigger.active {
    border-color: rgba(124,95,212,0.45);
    color: var(--accent-2);
    background: rgba(124,95,212,0.08);
  }

  /* Dot indicator */
  .dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    flex-shrink: 0;
    opacity: 0.6;
  }
  .dot.filled { background: var(--accent); border-color: var(--accent); opacity: 1; }

  .trig-name { flex: 1; text-align: left; font-weight: 600; }
  .trig-placeholder { flex: 1; text-align: left; }
  .trig-chevron { font-size: 0.7em; opacity: 0.5; margin-left: auto; }
  .trig-clear {
    font-size: 0.8em;
    opacity: 0.5;
    padding: 0 0.1em;
    line-height: 1;
    border-radius: 50%;
    margin-left: 0.1rem;
  }
  .trig-clear:hover { opacity: 1; }

  /* Dropdown picker */
  .picker {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 51;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-sm);
    box-shadow: 0 6px 24px rgba(0,0,0,0.45);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 18rem;
    overflow-y: auto;
  }
  .pick-divider { height: 1px; background: var(--border); margin: 0.15rem 0; }
  .pick-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.7rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.08s;
  }
  .pick-row:hover { background: var(--bg-2); }
  .pick-row.selected { background: rgba(124,95,212,0.1); }
  .clear-row { color: var(--text-dim); font-size: 0.85em; }

  .pick-dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    border: 1.5px solid var(--border-2);
    flex-shrink: 0;
    margin-top: 0.3em;
    transition: background 0.1s, border-color 0.1s;
  }
  .pick-dot.on { background: var(--accent); border-color: var(--accent); }

  .pick-body { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
  .pick-name { font-size: 0.88em; font-weight: 600; color: var(--text); }
  .pick-hint { font-size: 0.78em; color: var(--text-dim); line-height: 1.4; }
  .pick-label { font-size: 0.88em; color: var(--text-dim); }

  .pick-cost {
    font-size: 0.74em;
    padding: 0.08em 0.45em;
    border-radius: 999px;
    font-weight: 600;
    flex-shrink: 0;
    margin-top: 0.15em;
    align-self: flex-start;
  }
  .pick-cost.consume { background: rgba(224,106,106,0.16); color: var(--bad); border: 1px solid #6b2d2d; }
  .pick-cost.grant   { background: rgba(94,201,138,0.16);  color: var(--good); border: 1px solid #2d6b45; }

  /* Spell layers */
  .layers-row { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .layers-lbl { font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); font-weight: 600; flex-shrink: 0; }
  .layer-btn { font-size: 0.8em; padding: 0.2em 0.6em; border-radius: var(--radius-sm); border: 1px solid var(--border-2); background: var(--bg); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; transition: border-color 0.1s, background 0.1s, color 0.1s; }
  .layer-btn:hover { border-color: var(--accent-2); color: var(--text); }
  .layer-btn.on { border-color: var(--accent-2); background: rgba(124,95,212,0.15); color: var(--accent-2); font-weight: 600; }
  .layer-cost { font-size: 0.82em; opacity: 0.8; }
  .layer-cost.consume { color: var(--bad); }
  .layer-cost.grant { color: var(--good); }

  /* Tags */
  .tags { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }

  /* Description */
  .desc { display: flex; flex-direction: column; gap: 0.35rem; }
  .flavour { margin: 0; font-style: italic; color: var(--text-dim); font-size: 0.88em; }
  .effect { margin: 0; font-size: 0.92em; }
  .mod-effect {
    border-left: 2px solid var(--accent);
    background: rgba(124,95,212,0.06);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    padding: 0.3rem 0.5rem;
  }
  .mod-effect p { margin: 0; font-size: 0.92em; color: var(--accent-2); }

  .source { font-size: 0.76em; color: var(--text-faint); margin: 0; }

  /* Use row */
  .use-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.1rem; }
  .costs { display: flex; gap: 0.3rem; flex-wrap: wrap; flex: 1; }
  .cost-badge {
    font-size: 0.76em;
    padding: 0.12em 0.55em;
    border-radius: 999px;
    font-weight: 600;
  }
  .cost-badge.consume { background: rgba(224,106,106,0.16); color: var(--bad); border: 1px solid #6b2d2d; }
  .cost-badge.grant   { background: rgba(94,201,138,0.16);  color: var(--good); border: 1px solid #2d6b45; }
  .use-btn {
    font-size: 0.88em;
    font-weight: 600;
    padding: 0.4em 1.4em;
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .use-btn.consume { background: rgba(224,106,106,0.1); color: var(--bad); border: 1px solid #6b2d2d; }
  .use-btn.grant   { background: rgba(94,201,138,0.1);  color: var(--good); border: 1px solid #2d6b45; }
  .use-btn.neutral { background: var(--bg-3); color: var(--text); border: 1px solid var(--border-2); }
  .use-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .spell-pill {
    font-size: 0.72em;
    background: rgba(90, 130, 224, 0.14);
    border: 1px solid #5a82e0;
    border-radius: 999px;
    padding: 0.12em 0.7em;
    color: #8ab0f0;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Spell stats bar — fixed-height, text fits the cells */
  .spell-stats {
    display: flex;
    background: rgba(60, 100, 200, 0.10);
    border: 1px solid rgba(90, 130, 224, 0.3);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .spell-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.22rem 0.5rem;
    flex: 1;
    min-width: 0;
    border-right: 1px solid rgba(90, 130, 224, 0.2);
    overflow: hidden;
  }
  .spell-stat:last-child { border-right: none; }
  .spell-stat-lbl {
    font-size: 0.6em;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #7aa0d8;
    font-weight: 600;
    white-space: nowrap;
  }
  .spell-stat-val {
    font-size: 0.82em;
    font-weight: 600;
    color: #c8daf5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    text-align: center;
    line-height: 1.3;
  }
  .spell-stat-val.spell-modified {
    color: #a8d0ff;
    text-shadow: 0 0 8px rgba(90, 130, 224, 0.6);
  }

  /* Spell damage add badges (fallback when no {{ }} to inject into) */
  .spell-dmg-add {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.12rem 0.5rem;
    border-left: 2px solid #5a82e0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 0.85em;
    align-self: flex-start;
  }
  .spell-dmg-add-plus { color: #7aa0d8; font-weight: 700; }
  .spell-dmg-add-val { font-weight: 600; color: #c8daf5; }

  /* Variable mana picker */
  .mana-pick { display: inline-flex; align-items: center; gap: 0.15rem; font-size: 0.76em; color: #8ab0f0; }
  .mana-adj { padding: 0.05em 0.32em; background: rgba(90,130,224,0.12); border: 1px solid rgba(90,130,224,0.3); border-radius: var(--radius-sm); cursor: pointer; color: #8ab0f0; font-size: 0.85em; }
  .mana-adj:disabled { opacity: 0.3; cursor: not-allowed; }
  .mana-val { padding: 0 0.2rem; color: #a8c8f0; }
</style>
