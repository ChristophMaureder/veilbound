<script lang="ts">
  import { ruleset } from '../../stores';
  import type { SkillAction } from '../../types';
  import { uid } from '../../util';
  import ActionEditor from './ActionEditor.svelte';

  $: actions = $ruleset.standardActions;
  $: resources = $ruleset.resources;
  let selectedId: string | null = null;

  function setActions(next: SkillAction[]) { ruleset.update((r) => ({ ...r, standardActions: next })); }
  function add() {
    const a: SkillAction = { id: uid('std'), name: 'New Standard Action', cost: '1 Action', findingTags: [], ruleTags: [], flavour: '', effect: '', resource: null, weaponTarget: '', weaponMode: '' };
    setActions([...actions, a]);
    selectedId = a.id;
  }
  function update(next: SkillAction) { setActions(actions.map((a) => (a.id === next.id ? next : a))); }
  function remove(id: string) { setActions(actions.filter((a) => a.id !== id)); if (selectedId === id) selectedId = null; }
</script>

<section class="panel col" style="gap:.6rem">
  <div class="row wrap" style="align-items:center">
    <h3 style="margin:0">Standard actions</h3>
    <span class="faint" style="font-size:.85em">Owned by every character — shown in the Standard action tab. Players may hide individual ones.</span>
    <span class="spacer"></span>
    <button class="primary small" on:click={add}>+ Standard action</button>
  </div>

  {#if actions.length === 0}<p class="faint">No standard actions yet. Add ones like Dash, Dodge, or Attack.</p>{/if}

  <div class="list">
    {#each actions as a (a.id)}
      <div class="item">
        <button class="head" on:click={() => (selectedId = selectedId === a.id ? null : a.id)}>
          <span class="tw">{selectedId === a.id ? '▾' : '▸'}</span>
          <strong>{a.name || '(unnamed)'}</strong>
          <span class="faint cost">{a.cost}</span>
        </button>
        {#if selectedId === a.id}
          <ActionEditor action={a} {resources} on:change={(e) => update(e.detail)} on:remove={() => remove(a.id)} />
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .list { display: flex; flex-direction: column; gap: 0.4rem; }
  .item { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
  .head { width: 100%; display: flex; align-items: center; gap: 0.5rem; text-align: left; background: var(--bg-2); border: none; border-radius: 0; padding: 0.4rem 0.6rem; }
  .head:hover { background: var(--bg-3); }
  .tw { color: var(--text-faint); }
  .cost { margin-left: auto; font-size: 0.85em; }
  .small { font-size: 0.85em; }
</style>
