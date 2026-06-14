<script lang="ts">
  import { ruleset } from '../../stores';
  import type { ResourceDef, ResourceType } from '../../types';
  import { uid } from '../../util';

  $: r = $ruleset;
  const TYPES: ResourceType[] = ['dots', 'number', 'bar'];
  const asType = (v: string): ResourceType => (TYPES.includes(v as ResourceType) ? (v as ResourceType) : 'dots');

  function update(id: string, patch: Partial<ResourceDef>) {
    ruleset.update((rs) => ({ ...rs, resources: rs.resources.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  function add() {
    ruleset.update((rs) => ({
      ...rs,
      resources: [...rs.resources, { id: uid('res'), label: 'New Resource', type: 'dots', maxFormula: '3', colour: '#b98be0', shortRest: 0, longRest: 999, alwaysVisible: true }],
    }));
  }
  function remove(id: string) {
    ruleset.update((rs) => ({ ...rs, resources: rs.resources.filter((x) => x.id !== id) }));
  }
</script>

<section class="panel">
  <div class="row"><h3 style="margin:0">Resources</h3><span class="spacer"></span><button class="primary small" on:click={add}>+ Resource</button></div>
  <p class="faint" style="font-size:.83em">
    Mana is just a resource granted by a skill. Recovery numbers are how much a short/long rest restores
    (use a large number like 999 for “full”). Max is a formula (e.g. <span class="mono">KNO*4+WIL*2</span>).
    Images are out of scope — dots use default circles.
  </p>
  {#each r.resources as res (res.id)}
    <div class="card">
      <div class="grid">
        <div class="f"><label>Label</label><input value={res.label} on:input={(e) => update(res.id, { label: e.currentTarget.value })} /></div>
        <div class="f"><label>Type</label>
          <select value={res.type} on:change={(e) => update(res.id, { type: asType(e.currentTarget.value) })}>{#each TYPES as t}<option value={t}>{t}</option>{/each}</select></div>
        <div class="f"><label>Max (formula)</label><input class="mono" value={res.maxFormula} on:input={(e) => update(res.id, { maxFormula: e.currentTarget.value })} /></div>
        <div class="f"><label>Colour</label><input type="color" value={res.colour} on:input={(e) => update(res.id, { colour: e.currentTarget.value })} /></div>
        <div class="f"><label>Short rest +</label><input type="number" value={res.shortRest} on:input={(e) => update(res.id, { shortRest: Math.round(Number(e.currentTarget.value)) })} /></div>
        <div class="f"><label>Long rest +</label><input type="number" value={res.longRest} on:input={(e) => update(res.id, { longRest: Math.round(Number(e.currentTarget.value)) })} /></div>
        <div class="f chk"><label><input type="checkbox" checked={res.alwaysVisible} on:change={(e) => update(res.id, { alwaysVisible: e.currentTarget.checked })} /> Always visible</label></div>
      </div>
      <button class="danger small" on:click={() => remove(res.id)}>Remove</button>
    </div>
  {/each}
</section>

<style>
  section.panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.5rem;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .f input,
  .f select {
    width: 100%;
  }
  .chk {
    justify-content: flex-end;
  }
  .chk label {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .danger {
    align-self: flex-start;
  }
</style>
