<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ActionModifier, ResourceDef } from '../../types';
  import { ruleset, ensureTags } from '../../stores';
  import TagPicker from '../TagPicker.svelte';
  import NotationCheatSheet from '../NotationCheatSheet.svelte';

  export let modifier: ActionModifier;
  export let resources: ResourceDef[];

  const dispatch = createEventDispatcher<{ change: ActionModifier; remove: void }>();
  $: ruleTagNames = $ruleset.ruleTags.map((r) => r.tag);
  $: allSpellNames = [...new Set([
    ...$ruleset.standardActions.filter(a => a.isSpell).map(a => a.name),
    ...$ruleset.trees.flatMap(t => t.nodes.flatMap(n => n.actions.filter(a => a.isSpell).map(a => a.name))),
  ])].sort();
  let pendingRuleTag: string | null = null;
  let pendingDesc = '';

  function patch(p: Partial<ActionModifier>) { dispatch('change', { ...modifier, ...p }); }
  function setResourceUse(on: boolean) { patch({ resource: on ? { resourceId: resources[0]?.id ?? '', mode: 'consume', amount: 1 } : null }); }
  function patchResource(p: Partial<NonNullable<ActionModifier['resource']>>) { if (modifier.resource) patch({ resource: { ...modifier.resource, ...p } }); }
  function onNewRuleTag(tag: string) { pendingRuleTag = tag; pendingDesc = ''; ensureTags([tag]); }
  function saveRuleTag() {
    if (!pendingRuleTag) return;
    const tag = pendingRuleTag;
    ruleset.update((r) => (r.ruleTags.some((d) => d.tag === tag) ? r : { ...r, ruleTags: [...r.ruleTags, { tag, description: pendingDesc }] }));
    pendingRuleTag = null;
  }
</script>

<div class="me">
  <div class="grid">
    <div class="f"><label>Name</label><input value={modifier.name} on:input={(e) => patch({ name: e.currentTarget.value })} /></div>
  </div>
  <div class="f">
    <label>Applies to</label>
    <div class="tmode-row">
      <button class="tmode-btn" class:active={modifier.targetMode === 'tags'} on:click={() => patch({ targetMode: 'tags' })}>By rule tags</button>
      <button class="tmode-btn" class:active={modifier.targetMode === 'spells'} on:click={() => patch({ targetMode: 'spells' })}>By spell name</button>
    </div>
    {#if modifier.targetMode === 'spells'}
      <TagPicker selected={modifier.spellNames} available={allSpellNames} allowCreate={false} placeholder="Pick spell…" on:change={(e) => patch({ spellNames: e.detail })} />
    {:else}
      <TagPicker selected={modifier.actionTags} available={ruleTagNames} allowCreate={false} placeholder="Pick tag… (empty = attack)" on:change={(e) => patch({ actionTags: e.detail })} />
    {/if}
  </div>
  <div class="row wrap" style="gap:.5rem">
    <label class="mini">Only attack type<input class="mode" value={modifier.attackType} placeholder="(any)" on:input={(e) => patch({ attackType: e.currentTarget.value })} title="Restrict to weapon modes of this attack type, e.g. slash, thrust (empty = any)" /></label>
    <label class="mini role-toggle" title="Spell modifiers apply to spell actions (stackable, multi-select). Martial modifiers apply to non-spell actions (radio-select, one at a time).">
      <input type="checkbox" checked={!!modifier.stackable} on:change={(e) => patch({ stackable: e.currentTarget.checked || undefined })} />
      {#if modifier.stackable}<span class="role spell-role">✦ Spell modifier</span>{:else}<span class="role martial-role">⚔ Martial modifier</span>{/if}
    </label>
  </div>

  {#if modifier.stackable}
    <!-- Spell modifier fields -->
    <div class="section-head spell-head">Spell modifications (shown on card while active)</div>
    <div class="f"><label>Damage add (e.g. "+1d6 Fire")</label><input class="mono" value={modifier.spellDamageAdd ?? ''} placeholder="e.g. +1d6 Fire" on:input={(e) => patch({ spellDamageAdd: e.currentTarget.value || undefined })} /></div>
    <div class="spell-grid">
      <div class="f"><label>Range add (ft)</label><input class="num" type="number" value={modifier.spellRangeAdd ?? ''} placeholder="e.g. 15" on:input={(e) => { const v = e.currentTarget.value; patch({ spellRangeAdd: v ? Number(v) : undefined }); }} /></div>
      <div class="f"><label>Range override (absolute, e.g. "90 ft")</label><input value={modifier.spellRangeOverride ?? ''} placeholder="e.g. 90 ft" on:input={(e) => patch({ spellRangeOverride: e.currentTarget.value || undefined })} /></div>
    </div>
    <div class="spell-grid">
      <div class="f"><label>Targets add (fixed count)</label><input class="num" type="number" value={modifier.spellTargetsAdd ?? ''} placeholder="e.g. 1" on:input={(e) => { const v = e.currentTarget.value; patch({ spellTargetsAdd: v ? Number(v) : undefined }); }} /></div>
      <div class="f"><label>Targets override (absolute text)</label><input value={modifier.spellTargetsOverride ?? ''} placeholder="e.g. any (2 per mana)" on:input={(e) => patch({ spellTargetsOverride: e.currentTarget.value || undefined })} /></div>
    </div>
    <div class="spell-grid">
      <div class="f"><label>Targets per mana (variable UI)</label><input class="num" type="number" value={modifier.spellTargetsPerMana ?? ''} placeholder="e.g. 2" on:input={(e) => { const v = e.currentTarget.value; patch({ spellTargetsPerMana: v ? Number(v) : undefined }); }} title="Enables a mana-spend picker on the card. Each mana spent adds this many targets." /></div>
      <div class="f"><label>Max mana (blank = unlimited)</label><input class="num" type="number" value={modifier.spellManaMax ?? ''} placeholder="∞" on:input={(e) => { const v = e.currentTarget.value; patch({ spellManaMax: v ? Number(v) : undefined }); }} /></div>
    </div>
    <div class="f"><label>Replaces modifier ID (upgrade chain — hides the other modifier when this is available)</label><input value={modifier.replacesModifierId ?? ''} placeholder="mod_id_to_hide" on:input={(e) => patch({ replacesModifierId: e.currentTarget.value || undefined })} /></div>
  {:else}
    <!-- Martial modifier fields -->
    <div class="section-head">Weapon attack modification</div>
    <div class="grid">
      <div class="f"><label>Adds damage</label><input class="mono" value={modifier.attackDamage} placeholder="e.g. 2d8 fire  ·  4  ·  main" on:input={(e) => patch({ attackDamage: e.currentTarget.value })} /></div>
      <div class="f"><label>+ to hit</label><input class="mono" value={modifier.attackToHit} placeholder="e.g. 2  ·  prof" on:input={(e) => patch({ attackToHit: e.currentTarget.value })} /></div>
    </div>
  {/if}
  <div class="f"><label>Adds rule tags (drawbacks, shown while active)</label><TagPicker selected={modifier.addRuleTags} available={ruleTagNames} on:change={(e) => patch({ addRuleTags: e.detail })} on:create={(e) => onNewRuleTag(e.detail)} /></div>
  <div class="f"><label>Flavour</label><input value={modifier.flavour} on:input={(e) => patch({ flavour: e.currentTarget.value })} /></div>
  <div class="f"><label>Effect (shown when active — embed {'{{'}formula{'}}'} or dice)</label><textarea value={modifier.effect} on:input={(e) => patch({ effect: e.currentTarget.value })}></textarea></div>
  <div class="resuse row wrap">
    <label class="row" style="gap:.3rem"><input type="checkbox" checked={!!modifier.resource} on:change={(e) => setResourceUse(e.currentTarget.checked)} /> Costs a resource</label>
    {#if modifier.resource}
      <select value={modifier.resource.mode} on:change={(e) => patchResource({ mode: e.currentTarget.value === 'grant' ? 'grant' : 'consume' })}><option value="consume">consume</option><option value="grant">grant</option></select>
      <select value={modifier.resource.resourceId} on:change={(e) => patchResource({ resourceId: e.currentTarget.value })}>{#each resources as r}<option value={r.id}>{r.label}</option>{/each}</select>
      <input class="num" type="number" min="0" value={modifier.resource.amount} on:input={(e) => patchResource({ amount: Math.max(0, Number(e.currentTarget.value)) })} />
    {/if}
  </div>
  <NotationCheatSheet weapon={true} />
  <button class="danger small" on:click={() => dispatch('remove')}>Remove modifier</button>
</div>

{#if pendingRuleTag}
  <div class="rtprompt">
    <div class="box panel">
      <h4 style="margin-top:0">Define rule tag “{pendingRuleTag}”</h4>
      <textarea placeholder="What does this rule tag mean?" bind:value={pendingDesc}></textarea>
      <div class="row" style="justify-content:flex-end;margin-top:.5rem"><button class="small" on:click={() => (pendingRuleTag = null)}>Skip</button><button class="small primary" on:click={saveRuleTag}>Save</button></div>
    </div>
  </div>
{/if}

<style>
  .me { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f select, .f textarea { width: 100%; }
  .mono { font-variant-numeric: tabular-nums; }
  .mini { font-size: 0.8em; display: flex; gap: 0.3rem; align-items: center; }
  .mini .mode { width: 140px; }
  .num { width: 70px; }
  .small { font-size: 0.85em; }
  .rtprompt { position: fixed; inset: 0; background: rgba(8,7,12,0.6); display: flex; align-items: center; justify-content: center; z-index: 200; }
  .box { width: min(420px, 90%); }
  .box textarea { width: 100%; }
  .tmode-row { display: flex; gap: 0.3rem; margin-bottom: 0.3rem; }
  .tmode-btn { flex: 1; font-size: 0.82em; padding: 0.28em 0.6em; border-radius: var(--radius-sm); border: 1px solid var(--border-2); background: var(--bg); color: var(--text-dim); cursor: pointer; transition: border-color 0.1s, color 0.1s, background 0.1s; }
  .tmode-btn:hover { border-color: var(--accent-2); color: var(--text); }
  .tmode-btn.active { border-color: var(--accent); background: rgba(124,95,212,0.12); color: var(--accent-2); font-weight: 600; }
  .role-toggle { cursor: pointer; }
  .role { font-weight: 600; font-size: 0.9em; }
  .spell-role { color: #8ab0f0; }
  .martial-role { color: var(--text-dim); }
  .section-head { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); font-weight: 600; margin-top: 0.1rem; }
  .spell-head { color: #7aa0d8; }
  .spell-grid { display: grid; grid-template-columns: 120px 1fr; gap: 0.5rem; }
  .spell-grid .num { width: 100%; }
</style>
