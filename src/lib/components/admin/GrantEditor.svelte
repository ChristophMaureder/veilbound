<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Grant, GrantMode, CoreStat, DamageTerm, WeaponMode } from '../../types';
  import { FIXED_MODIFIER_TARGETS, GRANT_MODES, GRANT_MODE_LABELS, CORE_STATS } from '../../types';
  import { ruleset } from '../../stores';
  import { uid } from '../../util';
  import ModifierEditor from './ModifierEditor.svelte';

  /** Edits an array of grants shared by skill nodes and items. */
  export let grants: Grant[];
  export let context: 'skill' | 'item' = 'skill';
  export let treeModifiers: { id: string; name: string }[] = [];

  const dispatch = createEventDispatcher<{ change: Grant[] }>();
  $: resources = $ruleset.resources;
  $: damageTypes = $ruleset.damageTypes;
  $: targetOptions = [...FIXED_MODIFIER_TARGETS, ...resources.map((r) => r.id)];
  $: allItemTags = [...new Set($ruleset.items.flatMap((i) => i.tags))].sort();

  let newResName = '';
  let creatingFor: string | null = null;
  let addModeTagInput: Record<string, string> = {};

  function emit(next: Grant[]) {
    dispatch('change', next);
  }
  const asMode = (v: string): GrantMode => (GRANT_MODES.includes(v as GrantMode) ? (v as GrantMode) : 'add');
  const asStat = (v: string): CoreStat | '' => (CORE_STATS.includes(v as CoreStat) ? (v as CoreStat) : '');
  function patch(id: string, p: Partial<Grant>) {
    emit(grants.map((g) => (g.id === id ? ({ ...g, ...p } as Grant) : g)));
  }
  function remove(id: string) {
    emit(grants.filter((g) => g.id !== id));
  }
  function add(kind: Grant['kind']) {
    let g: Grant;
    if (kind === 'resource') g = { id: uid('g'), kind, resourceId: resources[0]?.id ?? '', amount: 1 };
    else if (kind === 'modifier') g = { id: uid('g'), kind, target: 'STR', value: 1, mode: 'add' };
    else if (kind === 'ac') g = { id: uid('g'), kind, low: '10', high: '15' };
    else if (kind === 'scaling') g = { id: uid('g'), kind: 'scaling', tag: '', attackTag: '', toHit: '', damage: '' };
    else if (kind === 'addmode') g = { id: uid('g'), kind: 'addmode', weaponTags: [], mode: { id: uid('m'), name: 'New Mode', attackType: '', damage: [{ id: uid('d'), notation: '1d6', typeId: damageTypes[0]?.id ?? '' }], scaleToHit: 'STR', scaleDamage: '', toHitBonus: 0 } };
    else if (kind === 'attackmod') g = { id: uid('g'), kind: 'attackmod', modifier: { id: uid('mod'), name: 'New Modifier', targetMode: 'tags', actionTags: ['attack'], spellNames: [], attackType: '', attackDamage: '', attackToHit: '', addRuleTags: [], effect: '', flavour: '', resource: null } };
    else if (kind === 'actionext') g = { id: uid('g'), kind: 'actionext', actionTag: '', target: '', range: '' };
    else g = { id: uid('g'), kind: 'dmgbonus', weaponTag: '', attackName: '', attackType: '', toHitBonus: '', formula: '1', damageTypeId: damageTypes[0]?.id ?? '' };
    emit([...grants, g]);
  }
  function patchMode(grantId: string, p: Partial<WeaponMode>) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, ...p } });
  }
  function patchModeTerm(grantId: string, termId: string, p: Partial<DamageTerm>) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damage: g.mode.damage.map((t) => (t.id === termId ? { ...t, ...p } : t)) } });
  }
  function addModeTerm(grantId: string) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damage: [...g.mode.damage, { id: uid('d'), notation: '1d6', typeId: damageTypes[0]?.id ?? '' }] } });
  }
  function removeModeTerm(grantId: string, termId: string) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damage: g.mode.damage.filter((t) => t.id !== termId) } });
  }
  function toggleModeTermTwoHanded(grantId: string, on: boolean) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damageTwoHanded: on ? [{ id: uid('d'), notation: '1d8', typeId: damageTypes[0]?.id ?? '' }] : undefined } });
  }
  function patchModeTermTwoHanded(grantId: string, termId: string, p: Partial<DamageTerm>) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damageTwoHanded: (g.mode.damageTwoHanded ?? []).map((t) => (t.id === termId ? { ...t, ...p } : t)) } });
  }
  function addModeTermTwoHanded(grantId: string) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damageTwoHanded: [...(g.mode.damageTwoHanded ?? []), { id: uid('d'), notation: '1d8', typeId: damageTypes[0]?.id ?? '' }] } });
  }
  function removeModeTermTwoHanded(grantId: string, termId: string) {
    const g = grants.find((x) => x.id === grantId);
    if (!g || g.kind !== 'addmode') return;
    patch(grantId, { mode: { ...g.mode, damageTwoHanded: (g.mode.damageTwoHanded ?? []).filter((t) => t.id !== termId) } });
  }

  function createResource(grantId: string) {
    const name = newResName.trim();
    if (!name) return;
    const id = uid('res');
    ruleset.update((r) => ({
      ...r,
      resources: [...r.resources, { id, label: name, type: 'number', maxFormula: '0', colour: '#b98be0', shortRest: 0, longRest: 999, alwaysVisible: false }],
    }));
    patch(grantId, { resourceId: id });
    newResName = '';
    creatingFor = null;
  }
</script>

<div class="grants">
  {#each grants as g (g.id)}
    <div class="grant">
      <span class="kind">{g.kind}</span>
      {#if g.kind === 'resource'}
        <select value={g.resourceId} on:change={(e) => { if (e.currentTarget.value === '__new') { creatingFor = g.id; } else patch(g.id, { resourceId: e.currentTarget.value }); }}>
          {#each resources as r}<option value={r.id}>{r.label}</option>{/each}
          <option value="__new">+ new resource…</option>
        </select>
        <select title="How multiple grants to this resource stack" value={g.mode ?? 'add'} on:change={(e) => patch(g.id, { mode: e.currentTarget.value === 'max' ? 'max' : 'add' })}>
          <option value="add">+ add</option>
          <option value="max">↑ max</option>
        </select>
        <input class="num" type="number" value={g.amount} on:input={(e) => patch(g.id, { amount: Math.round(Number(e.currentTarget.value)) })} />
        {#if creatingFor === g.id}
          <span class="inlinecreate">
            <input placeholder="New resource name" bind:value={newResName} />
            <button class="small primary" on:click={() => createResource(g.id)}>Create</button>
          </span>
        {/if}
      {:else if g.kind === 'modifier'}
        <select value={g.mode} on:change={(e) => patch(g.id, { mode: asMode(e.currentTarget.value) })}>
          {#each GRANT_MODES as m}<option value={m}>{GRANT_MODE_LABELS[m]}</option>{/each}
        </select>
        <select value={g.target} on:change={(e) => patch(g.id, { target: e.currentTarget.value })}>
          {#each targetOptions as t}<option value={t}>{t}</option>{/each}
        </select>
        <input class="num" type="number" value={g.value} on:input={(e) => patch(g.id, { value: Math.round(Number(e.currentTarget.value)) })} />
      {:else if g.kind === 'ac'}
        <select value={g.mode ?? 'set'} on:change={(e) => patch(g.id, { mode: e.currentTarget.value === 'adjust' ? 'adjust' : 'set' })}>
          <option value="set">Set range</option>
          <option value="adjust">Adjust range</option>
        </select>
        <input class="mono" placeholder="low" value={g.low} on:input={(e) => patch(g.id, { low: e.currentTarget.value })} title="Formula for low AC (or delta if Adjust mode)" />
        <input class="mono" placeholder="high" value={g.high} on:input={(e) => patch(g.id, { high: e.currentTarget.value })} title="Formula for high AC (or delta if Adjust mode)" />
      {:else if g.kind === 'scaling'}
        <input placeholder="weapon tag (empty=any)" value={g.tag} on:input={(e) => patch(g.id, { tag: e.currentTarget.value })} />
        <input placeholder="attack type (empty=any)" value={g.attackTag ?? ''} on:input={(e) => patch(g.id, { attackTag: e.currentTarget.value })} />
        <label class="mini">to-hit
          <select value={g.toHit} on:change={(e) => patch(g.id, { toHit: asStat(e.currentTarget.value) })}>
            <option value="">—</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}
          </select></label>
        <label class="mini">dmg
          <select value={g.damage} on:change={(e) => patch(g.id, { damage: asStat(e.currentTarget.value) })}>
            <option value="">—</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}
          </select></label>
      {:else if g.kind === 'addmode'}
        <div class="tagchips">
          <span class="faint small">Weapons:</span>
          {#each (g.weaponTags ?? (g.weaponTag ? [g.weaponTag] : [])) as wt}
            <span class="pill">{wt}<button class="x" on:click={() => patch(g.id, { weaponTags: (g.weaponTags ?? []).filter((t) => t !== wt) })}>×</button></span>
          {/each}
          <input list="wtags-{g.id}" placeholder="+ tag (empty=all)" value={addModeTagInput[g.id] ?? ''}
            on:input={(e) => (addModeTagInput = { ...addModeTagInput, [g.id]: e.currentTarget.value })}
            on:keydown={(e) => { if (e.key === 'Enter') { const v = (addModeTagInput[g.id] ?? '').trim(); if (v && !(g.weaponTags ?? []).includes(v)) patch(g.id, { weaponTags: [...(g.weaponTags ?? []), v] }); addModeTagInput = { ...addModeTagInput, [g.id]: '' }; } }}
            style="width:120px" />
          <datalist id="wtags-{g.id}"><option value="main"></option><option value="secondary"></option>{#each allItemTags as t}<option value={t}></option>{/each}</datalist>
        </div>
        <div class="modeblock">
          <div class="moderow">
            <input placeholder="mode name" value={g.mode.name} on:input={(e) => patchMode(g.id, { name: e.currentTarget.value })} />
            <input placeholder="attack type" value={g.mode.attackType ?? ''} on:input={(e) => patchMode(g.id, { attackType: e.currentTarget.value })} style="width:90px" title="Attack type tag (e.g. thrust, slash)" />
            <label class="mini">to-hit
              <select value={g.mode.scaleToHit} on:change={(e) => patchMode(g.id, { scaleToHit: asStat(e.currentTarget.value) })}>
                <option value="">default</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}
              </select></label>
            <label class="mini">dmg
              <select value={g.mode.scaleDamage} on:change={(e) => patchMode(g.id, { scaleDamage: asStat(e.currentTarget.value) })}>
                <option value="">none</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}
              </select></label>
            <label class="mini">+hit <input class="num" type="number" value={g.mode.toHitBonus} on:input={(e) => patchMode(g.id, { toHitBonus: Math.round(Number(e.currentTarget.value)) })} /></label>
            <label class="mini" title="Add a separate damage set used when the target weapon has the two-handed tag">
              <input type="checkbox" checked={!!(g.mode.damageTwoHanded)} on:change={(e) => toggleModeTermTwoHanded(g.id, e.currentTarget.checked)} />
              2H variant
            </label>
          </div>
          {#if g.mode.damageTwoHanded}<span class="dmglabel faint small">1H damage</span>{/if}
          <div class="terms">
            {#each g.mode.damage as t (t.id)}
              <span class="term">
                <input class="not" value={t.notation} on:input={(e) => patchModeTerm(g.id, t.id, { notation: e.currentTarget.value })} placeholder="1d6" />
                <select value={t.typeId} on:change={(e) => patchModeTerm(g.id, t.id, { typeId: e.currentTarget.value })}>{#each damageTypes as d}<option value={d.id}>{d.name}</option>{/each}</select>
                <button class="x" on:click={() => removeModeTerm(g.id, t.id)}>×</button>
              </span>
            {/each}
            <button class="small" on:click={() => addModeTerm(g.id)}>+ {g.mode.damageTwoHanded ? '1H ' : ''}term</button>
          </div>
          {#if g.mode.damageTwoHanded}
            <span class="dmglabel faint small">2H damage</span>
            <div class="terms">
              {#each g.mode.damageTwoHanded as t (t.id)}
                <span class="term">
                  <input class="not" value={t.notation} on:input={(e) => patchModeTermTwoHanded(g.id, t.id, { notation: e.currentTarget.value })} placeholder="1d8" />
                  <select value={t.typeId} on:change={(e) => patchModeTermTwoHanded(g.id, t.id, { typeId: e.currentTarget.value })}>{#each damageTypes as d}<option value={d.id}>{d.name}</option>{/each}</select>
                  <button class="x" on:click={() => removeModeTermTwoHanded(g.id, t.id)}>×</button>
                </span>
              {/each}
              <button class="small" on:click={() => addModeTermTwoHanded(g.id)}>+ 2H term</button>
            </div>
          {/if}
        </div>
      {:else if g.kind === 'attackmod'}
        <div class="modwrap">
          <ModifierEditor modifier={g.modifier} {resources} {treeModifiers} on:change={(e) => patch(g.id, { modifier: e.detail })} on:remove={() => remove(g.id)} />
        </div>
      {:else if g.kind === 'actionext'}
        <div class="extrow">
          <span class="faint small">Match by (any):</span>
          <input placeholder="rule tag (e.g. spell, fire)" value={g.actionTag} on:input={(e) => patch(g.id, { actionTag: e.currentTarget.value })} title="Match actions carrying this rule tag" style="flex:1;min-width:100px" />
          <input placeholder="spell/action name (e.g. Firebolt)" value={g.actionName ?? ''} on:input={(e) => patch(g.id, { actionName: e.currentTarget.value || undefined })} title="Match by exact action or spell name (case-insensitive)" style="flex:1;min-width:110px" />
          <input placeholder="attack type (e.g. thrust)" value={g.attackType ?? ''} on:input={(e) => patch(g.id, { attackType: e.currentTarget.value || undefined })} title="Match actions whose linked weapon mode has this attack type" style="flex:1;min-width:90px" />
        </div>
        <div class="extrow">
          <span class="faint small">Change:</span>
          <label class="mini">+Range ft<input class="num" type="number" placeholder="0" value={g.rangeAdd ?? ''} on:input={(e) => { const v = e.currentTarget.value; patch(g.id, { rangeAdd: v ? Number(v) : undefined }); }} title="Permanent ft added to numeric range on spell cards" /></label>
          <label class="mini">Range text<input placeholder="e.g. +30 ft" value={g.range ?? ''} on:input={(e) => patch(g.id, { range: e.currentTarget.value || undefined })} title="Text shown in meta-row (non-spell) or as fallback" /></label>
          <label class="mini">+Target<input placeholder="e.g. 2 creatures" value={g.target ?? ''} on:input={(e) => patch(g.id, { target: e.currentTarget.value || undefined })} /></label>
          <label class="mini" title="+Dmg is injected into the last {{}} formula in the effect text — same-type dice combine automatically (e.g. 1d6 fire + 1d6 fire → 2d6 fire). Supports formula vars like STR, prof.">+Dmg<input placeholder="e.g. +1d6 Fire" value={g.dmgAdd ?? ''} on:input={(e) => patch(g.id, { dmgAdd: e.currentTarget.value || undefined })} /></label>
          <label class="mini" title="To-hit bonus formula (e.g. 2, prof, STR/4). Shows on spell cards; adds to attack box if a weapon is linked.">+Hit<input class="mono" placeholder="e.g. 2" value={g.toHitBonus ?? ''} on:input={(e) => patch(g.id, { toHitBonus: e.currentTarget.value || undefined })} style="width:60px" /></label>
        </div>
      {:else if g.kind === 'dmgbonus'}
        <div class="dmgrow">
          <input list="slot-tags" placeholder="weapon tag, main, secondary (empty=any)" value={g.weaponTag ?? ''} on:input={(e) => patch(g.id, { weaponTag: e.currentTarget.value })} title="Comma-separated: weapon tags, 'main', or 'secondary'. Empty = any weapon." />
          <datalist id="slot-tags"><option value="main"></option><option value="secondary"></option>{#each allItemTags as t}<option value={t}></option>{/each}</datalist>
          <input placeholder="attack name (empty=any)" value={g.attackName ?? ''} on:input={(e) => patch(g.id, { attackName: e.currentTarget.value })} title="Only apply to modes whose name matches (empty = any)" />
          <input placeholder="attack type (empty=any)" value={g.attackType ?? ''} on:input={(e) => patch(g.id, { attackType: e.currentTarget.value })} title="Only apply to modes whose attack type matches, e.g. thrust (empty = any)" />
        </div>
        <div class="dmgrow">
          <label class="mini">+hit <input class="mono num" placeholder="0" value={g.toHitBonus ?? ''} on:input={(e) => patch(g.id, { toHitBonus: e.currentTarget.value })} title="To-hit bonus formula (e.g. STR/2 or 2)" /></label>
          <input class="mono" placeholder="dmg formula e.g. STR/2" value={g.formula} on:input={(e) => patch(g.id, { formula: e.currentTarget.value })} title="Damage bonus formula: use STR DEX KNO WIL prof level" />
          <select value={g.damageTypeId} on:change={(e) => patch(g.id, { damageTypeId: e.currentTarget.value })}><option value="">Inherit from weapon</option>{#each damageTypes as d}<option value={d.id}>{d.name}</option>{/each}</select>
        </div>
      {/if}
      <button class="ghost small" on:click={() => remove(g.id)} aria-label="Remove grant">✕</button>
    </div>
  {/each}
  <div class="addrow row wrap">
    <span class="faint small">Add grant:</span>
    <button class="small" on:click={() => add('resource')}>+ Resource</button>
    <button class="small" on:click={() => add('modifier')}>+ Stat/Bonus</button>
    <button class="small" on:click={() => add('ac')}>+ Armour AC</button>
    <button class="small" on:click={() => add('addmode')}>+ Weapon mode</button>
    <button class="small" on:click={() => add('attackmod')}>+ Modifier</button>
    <button class="small" on:click={() => add('actionext')}>+ Action Modifier</button>
  </div>
</div>

<style>
  .grants {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .grant {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    flex-wrap: wrap;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.45rem;
  }
  .kind {
    font-size: 0.72em;
    text-transform: uppercase;
    color: var(--text-faint);
    width: 56px;
  }
  .grant input {
    flex: 1;
    min-width: 70px;
  }
  .grant .num {
    flex: 0 0 70px;
  }
  .plus {
    color: var(--text-dim);
  }
  .mini {
    font-size: 0.78em;
    display: flex;
    gap: 0.2rem;
    align-items: center;
  }
  .inlinecreate {
    display: flex;
    gap: 0.3rem;
    flex-basis: 100%;
  }
  .modeblock {
    flex-basis: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.4rem;
    margin-top: 0.1rem;
  }
  .moderow {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .dmglabel { display: block; margin-top: 0.15rem; }
  .terms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .term {
    display: inline-flex;
    gap: 0.2rem;
    align-items: center;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.1rem 0.25rem;
  }
  .not { width: 56px; }
  .tagchips { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; flex-basis: 100%; }
  .tagchips input { min-width: 80px; }
  .modwrap { flex-basis: 100%; }
  .dmgrow { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; flex-basis: 100%; }
  .dmgrow input, .dmgrow select { flex: 1; min-width: 80px; }
  .extrow { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; flex-basis: 100%; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; }
  .small {
    font-size: 0.85em;
  }
</style>
