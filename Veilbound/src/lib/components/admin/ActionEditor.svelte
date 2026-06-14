<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SkillAction, ResourceDef } from '../../types';
  import { ruleset, ensureTags } from '../../stores';
  import TagPicker from '../TagPicker.svelte';
  import CostInput from './CostInput.svelte';

  export let action: SkillAction;
  export let resources: ResourceDef[];

  const dispatch = createEventDispatcher<{ change: SkillAction; remove: void }>();
  $: globalTags = $ruleset.tags;
  $: ruleTagNames = $ruleset.ruleTags.map((r) => r.tag);
  let pendingRuleTag: string | null = null;
  let pendingDesc = '';

  function patch(p: Partial<SkillAction>) { dispatch('change', { ...action, ...p }); }
  function setResourceUse(on: boolean) { patch({ resource: on ? { resourceId: resources[0]?.id ?? '', mode: 'consume', amount: 1 } : null }); }
  function patchResource(p: Partial<NonNullable<SkillAction['resource']>>) { if (action.resource) patch({ resource: { ...action.resource, ...p } }); }
  function onNewRuleTag(tag: string) { pendingRuleTag = tag; pendingDesc = ''; ensureTags([tag]); }
  function saveRuleTag() {
    if (!pendingRuleTag) return;
    const tag = pendingRuleTag;
    ruleset.update((r) => (r.ruleTags.some((d) => d.tag === tag) ? r : { ...r, ruleTags: [...r.ruleTags, { tag, description: pendingDesc }] }));
    pendingRuleTag = null;
  }
</script>

<div class="ae">
  <div class="grid">
    <div class="f"><label>Name</label><input value={action.name} on:input={(e) => patch({ name: e.currentTarget.value })} /></div>
    <div class="f"><label>Cost</label><CostInput value={action.cost} on:change={(e) => patch({ cost: e.detail })} /></div>
  </div>
  <div class="row wrap" style="gap:.5rem">
    <label class="mini">Weapon
      <select value={action.weaponTarget} on:change={(e) => patch({ weaponTarget: e.currentTarget.value === 'main' ? 'main' : e.currentTarget.value === 'secondary' ? 'secondary' : '' })}>
        <option value="">— none —</option><option value="main">Main</option><option value="secondary">Secondary</option>
      </select></label>
    {#if action.weaponTarget}<label class="mini">Mode<input class="mode" value={action.weaponMode} placeholder="(any)" on:input={(e) => patch({ weaponMode: e.currentTarget.value })} /></label>{/if}
  </div>
  <div class="f"><label>Finding tags (hidden except in search)</label><TagPicker selected={action.findingTags} available={globalTags} on:change={(e) => patch({ findingTags: e.detail })} on:create={(e) => ensureTags([e.detail])} /></div>
  <div class="f"><label>Rule tags (hover shows definition)</label><TagPicker selected={action.ruleTags} available={ruleTagNames} on:change={(e) => patch({ ruleTags: e.detail })} on:create={(e) => onNewRuleTag(e.detail)} /></div>
  <div class="f"><label>Flavour</label><input value={action.flavour} on:input={(e) => patch({ flavour: e.currentTarget.value })} /></div>
  <div class="f"><label>Effect (embed {'{{'}formula{'}}'} or dice like 2d6)</label><textarea value={action.effect} on:input={(e) => patch({ effect: e.currentTarget.value })}></textarea></div>
  <div class="resuse row wrap">
    <label class="row" style="gap:.3rem"><input type="checkbox" checked={!!action.resource} on:change={(e) => setResourceUse(e.currentTarget.checked)} /> Uses a resource</label>
    {#if action.resource}
      <select value={action.resource.mode} on:change={(e) => patchResource({ mode: e.currentTarget.value === 'grant' ? 'grant' : 'consume' })}><option value="consume">consume</option><option value="grant">grant</option></select>
      <select value={action.resource.resourceId} on:change={(e) => patchResource({ resourceId: e.currentTarget.value })}>{#each resources as r}<option value={r.id}>{r.label}</option>{/each}</select>
      <input class="num" type="number" min="0" value={action.resource.amount} on:input={(e) => patchResource({ amount: Math.max(0, Number(e.currentTarget.value)) })} />
    {/if}
  </div>
  <button class="danger small" on:click={() => dispatch('remove')}>Remove action</button>
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
  .ae { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f select, .f textarea { width: 100%; }
  .mini { font-size: 0.8em; display: flex; gap: 0.3rem; align-items: center; }
  .mini .mode { width: 110px; }
  .num { width: 70px; }
  .small { font-size: 0.85em; }
  .rtprompt { position: fixed; inset: 0; background: rgba(8,7,12,0.6); display: flex; align-items: center; justify-content: center; z-index: 200; }
  .box { width: min(420px, 90%); }
  .box textarea { width: 100%; }
</style>
