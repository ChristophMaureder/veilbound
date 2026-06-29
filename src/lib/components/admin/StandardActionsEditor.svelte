<script lang="ts">
  import { ruleset } from '../../stores';
  import type { SkillAction, ActionModifier } from '../../types';
  import { uid } from '../../util';
  import ActionEditor from './ActionEditor.svelte';
  import ModifierEditor from './ModifierEditor.svelte';
  import ProgressionCostsEditor from './ProgressionCostsEditor.svelte';

  $: actions = $ruleset.standardActions;
  $: modifiers = $ruleset.modifiers ?? [];
  $: resources = $ruleset.resources;
  let selectedId: string | null = null;
  let selectedModId: string | null = null;

  function setActions(next: SkillAction[]) { ruleset.update((r) => ({ ...r, standardActions: next })); }
  function add() {
    const a: SkillAction = { id: uid('std'), name: 'New Standard Action', cost: '1 Action', findingTags: [], ruleTags: [], flavour: '', effect: '', resources: [], weaponTarget: '', weaponMode: '' };
    setActions([...actions, a]);
    selectedId = a.id;
  }
  function update(next: SkillAction) { setActions(actions.map((a) => (a.id === next.id ? next : a))); }
  function remove(id: string) { setActions(actions.filter((a) => a.id !== id)); if (selectedId === id) selectedId = null; }

  function setModifiers(next: ActionModifier[]) { ruleset.update((r) => ({ ...r, modifiers: next })); }
  function addModifier() {
    const m: ActionModifier = { id: uid('mod'), name: 'New Modifier', targetMode: 'tags', actionTags: ['attack'], spellNames: [], attackType: '', attackDamage: '', attackToHit: '', addRuleTags: [], effect: '', flavour: '', resource: null };
    setModifiers([...modifiers, m]);
    selectedModId = m.id;
  }
  function updateModifier(next: ActionModifier) { setModifiers(modifiers.map((m) => (m.id === next.id ? next : m))); }
  function removeModifier(id: string) { setModifiers(modifiers.filter((m) => m.id !== id)); if (selectedModId === id) selectedModId = null; }
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

<section class="panel col" style="gap:.6rem">
  <div class="row wrap" style="align-items:center">
    <h3 style="margin:0">Attack modifiers</h3>
    <span class="faint" style="font-size:.85em">Toggled on matching action cards at play time (one at a time). Skills and items can also grant these.</span>
    <span class="spacer"></span>
    <button class="primary small" on:click={addModifier}>+ Modifier</button>
  </div>

  {#if modifiers.length === 0}<p class="faint">No modifiers yet. Add ones like Dash Attack or Determined Attack.</p>{/if}

  <div class="list">
    {#each modifiers as m (m.id)}
      <div class="item">
        <button class="head" on:click={() => (selectedModId = selectedModId === m.id ? null : m.id)}>
          <span class="tw">{selectedModId === m.id ? '▾' : '▸'}</span>
          <strong>{m.name || '(unnamed)'}</strong>
          <span class="faint cost">
            {m.targetMode === 'spells' ? m.spellNames.join(', ') || '(no spells)' : (m.actionTags.join(', ') || 'attack')}
          </span>
        </button>
        {#if selectedModId === m.id}
          <ModifierEditor modifier={m} {resources} on:change={(e) => updateModifier(e.detail)} on:remove={() => removeModifier(m.id)} />
        {/if}
      </div>
    {/each}
  </div>
</section>

<section class="panel col" style="gap:.6rem">
  <div class="row wrap" style="align-items:center">
    <h3 style="margin:0">Node cost progression</h3>
    <span class="faint" style="font-size:.85em">Default skill-point cost for each node level by tree type and rarity. Override per-node in the tree editor.</span>
  </div>
  <ProgressionCostsEditor />
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
