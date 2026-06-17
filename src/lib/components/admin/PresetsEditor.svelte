<script lang="ts">
  import { ruleset, activeCharacter } from '../../stores';
  import type { Preset, CoreStat, Tier } from '../../types';
  import { CORE_STATS, CORE_STAT_LABELS, TIERS, TIER_LABELS } from '../../types';
  import { uid, clone } from '../../util';

  $: presets = $ruleset.presets;
  $: standardActions = $ruleset.standardActions;
  $: char = $activeCharacter;
  let selectedId: string | null = null;
  $: selected = presets.find((p) => p.id === selectedId) ?? null;

  function setPresets(next: Preset[]) { ruleset.update((r) => ({ ...r, presets: next })); }
  function add() {
    const p: Preset = { id: uid('preset'), name: 'New Preset', description: '' };
    setPresets([...presets, p]);
    selectedId = p.id;
  }
  function patch(id: string, p: Partial<Preset>) { setPresets(presets.map((x) => (x.id === id ? { ...x, ...p } : x))); }
  function remove(id: string) { setPresets(presets.filter((p) => p.id !== id)); if (selectedId === id) selectedId = null; }

  function toggleStats(on: boolean) {
    if (!selected) return;
    patch(selected.id, { statTiers: on ? { STR: 'sec', DEX: 'sec', KNO: 'sec', WIL: 'sec' } : undefined });
  }
  function setTier(s: CoreStat, t: string) {
    if (!selected?.statTiers) return;
    patch(selected.id, { statTiers: { ...selected.statTiers, [s]: t as Tier } });
  }
  function toggleStd(id: string) {
    if (!selected) return;
    const cur = selected.standardActionIds ?? [];
    patch(selected.id, { standardActionIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  }
  function captureActionTabs() {
    if (!selected || !char) return;
    patch(selected.id, { actionTabs: char.actionTabs.filter((t) => (t.kind ?? 'normal') === 'normal').map((t) => clone(t)) });
  }
  function captureSkillTabs() {
    if (!selected || !char) return;
    patch(selected.id, { skillTabs: char.skillTabs.filter((t) => t.defaultInclude !== true).map((t) => clone(t)) });
  }
</script>

<section class="panel col" style="gap:.6rem">
  <div class="row wrap" style="align-items:center">
    <h3 style="margin:0">Presets</h3>
    <span class="faint" style="font-size:.85em">Starting points a player applies whole (at creation) or per-section.</span>
    <span class="spacer"></span>
    <button class="primary small" on:click={add}>+ Preset</button>
  </div>

  <div class="picker row wrap">
    {#each presets as p (p.id)}
      <button class="ptab" class:active={p.id === selectedId} on:click={() => (selectedId = p.id)}>{p.name || '(unnamed)'}</button>
    {/each}
    {#if presets.length === 0}<p class="faint" style="margin:0">No presets yet.</p>{/if}
  </div>

  {#if selected}
    {@const sel = selected}
    <div class="editor">
      <div class="grid">
        <div class="f"><label>Name</label><input value={sel.name} on:input={(e) => patch(sel.id, { name: e.currentTarget.value })} /></div>
      </div>
      <div class="f"><label>Description</label><textarea value={sel.description} on:input={(e) => patch(sel.id, { description: e.currentTarget.value })}></textarea></div>

      <div class="sec">
        <label class="row" style="gap:.4rem;font-weight:600"><input type="checkbox" checked={!!sel.statTiers} on:change={(e) => toggleStats(e.currentTarget.checked)} /> Suggest stat tiers (player reviews)</label>
        {#if sel.statTiers}
          <div class="tiers">
            {#each CORE_STATS as s}
              <label class="tier"><span>{CORE_STAT_LABELS[s]}</span>
                <select value={sel.statTiers[s]} on:change={(e) => setTier(s, e.currentTarget.value)}>
                  {#each TIERS as t}<option value={t}>{TIER_LABELS[t]}</option>{/each}
                </select>
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div class="sec">
        <div class="row" style="gap:.4rem;font-weight:600">Standard actions to keep visible {#if !sel.standardActionIds}<span class="faint" style="font-weight:400;font-size:.85em">(none = this section is skipped)</span>{/if}</div>
        <div class="chips">
          {#each standardActions as a (a.id)}
            <label class="chip" class:on={(sel.standardActionIds ?? []).includes(a.id)}><input type="checkbox" checked={(sel.standardActionIds ?? []).includes(a.id)} on:change={() => toggleStd(a.id)} /> {a.name}</label>
          {/each}
          {#if standardActions.length === 0}<span class="faint">No standard actions defined yet.</span>{/if}
        </div>
      </div>

      <div class="sec">
        <div class="row wrap" style="gap:.5rem;align-items:center">
          <span style="font-weight:600">Captured layouts:</span>
          <span class="faint small">{sel.actionTabs?.length ?? 0} action tab(s) · {sel.skillTabs?.length ?? 0} skill tab(s)</span>
          <span class="spacer"></span>
          <button class="small" disabled={!char} on:click={captureActionTabs} title="Snapshot the active character's action tabs">⎘ Capture action tabs</button>
          <button class="small" disabled={!char} on:click={captureSkillTabs} title="Snapshot the active character's skill tabs">⎘ Capture skill tabs</button>
          {#if sel.actionTabs?.length}<button class="small" on:click={() => patch(sel.id, { actionTabs: undefined })}>Clear action tabs</button>{/if}
          {#if sel.skillTabs?.length}<button class="small" on:click={() => patch(sel.id, { skillTabs: undefined })}>Clear skill tabs</button>{/if}
        </div>
        {#if !char}<p class="faint small" style="margin:.2rem 0 0">Select a character to capture its tab layouts.</p>{/if}
      </div>

      <button class="danger small" on:click={() => remove(sel.id)}>Delete preset</button>
    </div>
  {/if}
</section>

<style>
  .picker { gap: 0.3rem; }
  .ptab { border-radius: 999px; padding: 0.2em 0.7em; }
  .ptab.active { background: var(--gold); color: #2a2410; border-color: var(--gold); }
  .editor { display: flex; flex-direction: column; gap: 0.7rem; border-top: 1px solid var(--border); padding-top: 0.6rem; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f textarea { width: 100%; }
  .sec { display: flex; flex-direction: column; gap: 0.4rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.6rem; }
  .tiers { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .tier { display: flex; flex-direction: column; gap: 2px; font-size: 0.85em; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.85em; border: 1px solid var(--border-2); border-radius: 999px; padding: 0.1em 0.55em; cursor: pointer; }
  .chip.on { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .small { font-size: 0.85em; }
</style>
