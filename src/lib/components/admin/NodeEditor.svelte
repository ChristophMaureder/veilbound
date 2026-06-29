<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SkillNode, SkillAction, ResourceDef } from '../../types';
  import { uid } from '../../util';
  import GrantEditor from './GrantEditor.svelte';
  import ActionEditor from './ActionEditor.svelte';

  export let node: SkillNode;
  export let resources: ResourceDef[];
  export let treeModifiers: { id: string; name: string }[] = [];
  export let canBranch = false;
  export let treeType: 'skill' | 'spell' = 'skill';

  const dispatch = createEventDispatcher<{ change: SkillNode; remove: void }>();

  function patch(p: Partial<SkillNode>) { dispatch('change', { ...node, ...p }); }
  function updateAction(next: SkillAction) { patch({ actions: node.actions.map((a) => (a.id === next.id ? next : a)) }); }
  function removeAction(id: string) { patch({ actions: node.actions.filter((a) => a.id !== id) }); }
  function addAction() {
    patch({ actions: [...node.actions, { id: uid('act'), name: 'New Action', cost: '1 Action', findingTags: [], ruleTags: [], flavour: '', effect: '', resource: null, weaponTarget: '', weaponMode: '', isSpell: treeType === 'spell' || undefined }] });
  }
</script>

<div class="ne">
  <div class="grid">
    <div class="f"><label>Name</label><input value={node.name} on:input={(e) => patch({ name: e.currentTarget.value })} /></div>
    <div class="f"><label>Cost</label><input type="number" min="0" value={node.cost} on:input={(e) => patch({ cost: Math.max(0, Math.round(Number(e.currentTarget.value))) })} /></div>
  </div>

  <div class="f"><label>Description</label><textarea value={node.description} on:input={(e) => patch({ description: e.currentTarget.value })}></textarea></div>
  <div class="f"><label>Narrative gate (free text — only prompts the player if set; separate from connections)</label>
    <input value={node.prerequisite} on:input={(e) => patch({ prerequisite: e.currentTarget.value })} /></div>

  <div class="toggles">
    <span class="tlabel">Hide from players:</span>
    <label><input type="checkbox" checked={node.hideName} on:change={(e) => patch({ hideName: e.currentTarget.checked })} /> name</label>
    <label><input type="checkbox" checked={node.hideDescription} on:change={(e) => patch({ hideDescription: e.currentTarget.checked })} /> description</label>
    <label><input type="checkbox" checked={node.hidePrerequisite} on:change={(e) => patch({ hidePrerequisite: e.currentTarget.checked })} /> prerequisite</label>
  </div>

  {#if canBranch}
    <label class="excl"><input type="checkbox" checked={node.exclusive} on:change={(e) => patch({ exclusive: e.currentTarget.checked })} /> Branches from here are <strong>exclusive</strong> (pick one path)</label>
  {/if}

  <div class="block">
    <strong>Grants</strong>
    <GrantEditor grants={node.grants} context="skill" {treeModifiers} on:change={(e) => patch({ grants: e.detail })} />
  </div>

  <div class="block">
    <div class="row"><strong>Actions</strong><span class="spacer"></span><button class="small" on:click={addAction}>+ Action</button></div>
    {#each node.actions as a (a.id)}
      <ActionEditor action={a} {resources} on:change={(e) => updateAction(e.detail)} on:remove={() => removeAction(a.id)} />
    {/each}
  </div>

  <button class="danger small" on:click={() => dispatch('remove')}>Delete node</button>
</div>

<style>
  .ne { display: flex; flex-direction: column; gap: 0.6rem; }
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f textarea { width: 100%; }
  .toggles { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; }
  .toggles label { display: flex; gap: 0.3rem; align-items: center; }
  .tlabel { font-size: 0.85em; color: var(--text-dim); }
  .excl { display: flex; gap: 0.4rem; align-items: center; font-size: 0.9em; }
  .block { border-top: 1px solid var(--border); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .small { font-size: 0.85em; }
</style>
