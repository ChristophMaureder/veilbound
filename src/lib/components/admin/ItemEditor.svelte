<script lang="ts">
  import { ruleset, ensureTags } from '../../stores';
  import type { ItemDef, WeaponMode, DamageTerm, CoreStat, ShieldDef } from '../../types';
  import { CORE_STATS } from '../../types';
  import { uid } from '../../util';

  const asStat = (v: string): CoreStat | '' => (CORE_STATS.includes(v as CoreStat) ? (v as CoreStat) : '');
  import GrantEditor from './GrantEditor.svelte';
  import ActionEditor from './ActionEditor.svelte';
  import TagPicker from '../TagPicker.svelte';
  import Modal from '../Modal.svelte';
  import type { SkillAction } from '../../types';

  $: items = $ruleset.items;
  $: cats = $ruleset.itemCategories;
  $: damageTypes = $ruleset.damageTypes;

  let search = '';
  let filterTag = '';
  let filterCat = '';
  let expanded: string | null = null;
  $: allTags = [...new Set(items.flatMap((i) => i.tags))].sort();
  let showAdd = false;
  let showTypes = false;
  let addName = '';
  let addCat = '';

  $: shown = items.filter((i) => {
    const q = search.trim().toLowerCase();
    if (q && !(i.name.toLowerCase().includes(q) || String(i.level) === q || i.category.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)))) return false;
    if (filterTag && !i.tags.includes(filterTag)) return false;
    if (filterCat && i.category !== filterCat) return false;
    return true;
  });
  $: grouped = (() => {
    const m = new Map<string, ItemDef[]>();
    for (const i of shown) {
      const c = i.category || 'Uncategorised';
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(i);
    }
    return [...m.entries()];
  })();

  function update(id: string, patch: Partial<ItemDef>) {
    ruleset.update((rs) => ({ ...rs, items: rs.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  function addItem() {
    const id = uid('item');
    const cat = addCat.trim() || cats[0] || 'Gear';
    ruleset.update((rs) => ({
      ...rs,
      itemCategories: rs.itemCategories.includes(cat) ? rs.itemCategories : [...rs.itemCategories, cat],
      items: [...rs.items, { id, name: addName.trim() || 'New Item', description: '', level: 1, category: cat, tags: [], weight: 1, flavour: '', grants: [], actions: [], weapon: null, shield: null }],
    }));
    expanded = id;
    showAdd = false;
    addName = '';
    addCat = '';
  }
  function remove(id: string) {
    ruleset.update((rs) => ({ ...rs, items: rs.items.filter((x) => x.id !== id) }));
  }
  // item-granted actions
  function addAction(i: ItemDef) {
    update(i.id, { actions: [...i.actions, { id: uid('act'), name: 'New Action', cost: '1 Action', findingTags: [], ruleTags: [], flavour: '', effect: '', resources: [], weaponTarget: '', weaponMode: '' }] });
  }
  function updateAction(i: ItemDef, next: SkillAction) { update(i.id, { actions: i.actions.map((a) => (a.id === next.id ? next : a)) }); }
  function removeAction(i: ItemDef, id: string) { update(i.id, { actions: i.actions.filter((a) => a.id !== id) }); }

  // shield helpers
  function setShield(i: ItemDef, on: boolean) {
    update(i.id, { shield: on ? { dr: '2' } : null, weapon: on ? null : i.weapon });
  }
  function patchShield(i: ItemDef, patch: Partial<ShieldDef>) {
    if (!i.shield) return;
    update(i.id, { shield: { ...i.shield, ...patch } });
  }

  // weapon helpers
  function setWeapon(i: ItemDef, on: boolean) {
    update(i.id, { weapon: on ? { modes: [{ id: uid('m'), name: 'Strike', attackType: '', damage: [{ id: uid('d'), notation: '1d6', typeId: damageTypes[0]?.id ?? '' }], scaleToHit: 'STR', scaleDamage: 'STR', toHitBonus: 0 }] } : null });
  }
  function patchWeapon(i: ItemDef, patch: Partial<NonNullable<ItemDef['weapon']>>) {
    if (!i.weapon) return;
    update(i.id, { weapon: { ...i.weapon, ...patch } });
  }
  function patchMode(i: ItemDef, mid: string, patch: Partial<WeaponMode>) {
    if (!i.weapon) return;
    patchWeapon(i, { modes: i.weapon.modes.map((m) => (m.id === mid ? { ...m, ...patch } : m)) });
  }
  function addMode(i: ItemDef) {
    if (!i.weapon) return;
    patchWeapon(i, { modes: [...i.weapon.modes, { id: uid('m'), name: 'Mode', attackType: '', damage: [{ id: uid('d'), notation: '1d6', typeId: damageTypes[0]?.id ?? '' }], scaleToHit: 'STR', scaleDamage: '', toHitBonus: 0 }] });
  }
  function removeMode(i: ItemDef, mid: string) {
    if (!i.weapon) return;
    patchWeapon(i, { modes: i.weapon.modes.filter((m) => m.id !== mid) });
  }
  function patchTerm(i: ItemDef, mid: string, tid: string, patch: Partial<DamageTerm>) {
    if (!i.weapon) return;
    const m = i.weapon.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damage: m.damage.map((t) => (t.id === tid ? { ...t, ...patch } : t)) });
  }
  function addTerm(i: ItemDef, mid: string) {
    const m = i.weapon?.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damage: [...m.damage, { id: uid('d'), notation: '1d4', typeId: damageTypes[0]?.id ?? '' }] });
  }
  function removeTerm(i: ItemDef, mid: string, tid: string) {
    const m = i.weapon?.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damage: m.damage.filter((t) => t.id !== tid) });
  }
  function patchTermTwoHanded(i: ItemDef, mid: string, tid: string, patch: Partial<DamageTerm>) {
    if (!i.weapon) return;
    const m = i.weapon.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damageTwoHanded: (m.damageTwoHanded ?? []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) });
  }
  function addTermTwoHanded(i: ItemDef, mid: string) {
    const m = i.weapon?.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damageTwoHanded: [...(m.damageTwoHanded ?? []), { id: uid('d'), notation: '1d8', typeId: damageTypes[0]?.id ?? '' }] });
  }
  function removeTermTwoHanded(i: ItemDef, mid: string, tid: string) {
    const m = i.weapon?.modes.find((x) => x.id === mid);
    if (!m) return;
    patchMode(i, mid, { damageTwoHanded: (m.damageTwoHanded ?? []).filter((t) => t.id !== tid) });
  }

  // damage type management
  function addType() {
    ruleset.update((r) => ({ ...r, damageTypes: [...r.damageTypes, { id: uid('dt'), name: 'New Type', colour: '#d98a8a' }] }));
  }
  function patchType(id: string, patch: Partial<{ name: string; colour: string }>) {
    ruleset.update((r) => ({ ...r, damageTypes: r.damageTypes.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }
  function removeType(id: string) {
    ruleset.update((r) => ({ ...r, damageTypes: r.damageTypes.filter((d) => d.id !== id) }));
  }
</script>

<section class="panel">
  <div class="row wrap">
    <h3 style="margin:0">Items</h3>
    <span class="spacer"></span>
    <button class="small" on:click={() => (showTypes = !showTypes)}>Damage types</button>
    <button class="primary small" on:click={() => (showAdd = true)}>+ Add item</button>
  </div>
  <div class="row wrap">
    <input class="search" placeholder="Search items by name, tag, level, category…" bind:value={search} />
    <select bind:value={filterTag}><option value="">All tags</option>{#each allTags as t}<option value={t}>{t}</option>{/each}</select>
    <select bind:value={filterCat}><option value="">All categories</option>{#each cats as c}<option value={c}>{c}</option>{/each}</select>
  </div>

  {#if showTypes}
    <div class="types">
      <strong>Damage types & colours</strong>
      {#each damageTypes as d (d.id)}
        <div class="trow">
          <input type="color" value={d.colour} on:input={(e) => patchType(d.id, { colour: e.currentTarget.value })} />
          <input value={d.name} on:input={(e) => patchType(d.id, { name: e.currentTarget.value })} />
          <button class="ghost small" on:click={() => removeType(d.id)}>✕</button>
        </div>
      {/each}
      <button class="small" on:click={addType}>+ Type</button>
    </div>
  {/if}

  {#each grouped as [cat, list]}
    <div class="catsec">
      <div class="cathead">{cat} <span class="faint">({list.length})</span></div>
      {#each list as i (i.id)}
        <div class="item">
          <button class="namerow" on:click={() => (expanded = expanded === i.id ? null : i.id)}>
            <strong>{i.name}</strong>
            <span class="faint">L{i.level}{#if i.weapon} · weapon{/if}</span>
          </button>
          {#if expanded === i.id}
            <div class="detail">
              <div class="grid">
                <div class="f"><label>Name</label><input value={i.name} on:input={(e) => update(i.id, { name: e.currentTarget.value })} /></div>
                <div class="f"><label>Level</label><input type="number" value={i.level} on:input={(e) => update(i.id, { level: Math.round(Number(e.currentTarget.value)) })} /></div>
                <div class="f"><label>Weight</label><input type="number" value={i.weight} on:input={(e) => update(i.id, { weight: Number(e.currentTarget.value) })} /></div>
                <div class="f"><label>Category</label><input list="icats" value={i.category} on:input={(e) => update(i.id, { category: e.currentTarget.value })} />
                  <datalist id="icats">{#each cats as c}<option value={c}></option>{/each}</datalist></div>
              </div>
              <div class="f"><label>Flavour</label><input value={i.flavour} on:input={(e) => update(i.id, { flavour: e.currentTarget.value })} /></div>
              <div class="f"><label>Description</label><input value={i.description} on:input={(e) => update(i.id, { description: e.currentTarget.value })} /></div>
              <div class="f"><label>Tags</label><TagPicker selected={i.tags} available={$ruleset.tags} on:change={(e) => update(i.id, { tags: e.detail })} on:create={(e) => ensureTags([e.detail])} /></div>
              <div class="f"><label>Grants (when equipped)</label><GrantEditor grants={i.grants} context="item" on:change={(e) => update(i.id, { grants: e.detail })} /></div>

              <div class="f">
                <div class="row"><label>Granted actions</label><span class="spacer"></span><button class="small" on:click={() => addAction(i)}>+ Action</button></div>
                {#each i.actions as a (a.id)}
                  <ActionEditor action={a} resources={$ruleset.resources} on:change={(e) => updateAction(i, e.detail)} on:remove={() => removeAction(i, a.id)} />
                {/each}
              </div>

              <div class="weapon">
                <label class="row" style="gap:.4rem"><input type="checkbox" checked={!!i.shield} on:change={(e) => setShield(i, e.currentTarget.checked)} /> This is a shield</label>
                {#if i.shield}
                  <div class="f" style="max-width:280px">
                    <label>Damage Reduction formula</label>
                    <input value={i.shield.dr} on:input={(e) => patchShield(i, { dr: e.currentTarget.value })} placeholder="e.g. 2 or floor(STR / 4)" class="mono" />
                  </div>
                {/if}

                <label class="row" style="gap:.4rem"><input type="checkbox" checked={!!i.weapon} on:change={(e) => setWeapon(i, e.currentTarget.checked)} disabled={!!i.shield} /> This is a weapon</label>
                {#if i.weapon}
                  <div class="row" style="gap:.5rem">
                    <span class="faint small">Main/Secondary slot is assigned by the player on the sheet.</span>
                    <span class="spacer"></span>
                    <button class="small" on:click={() => addMode(i)}>+ Use-mode</button>
                  </div>
                  {#each i.weapon.modes as m (m.id)}
                    <div class="mode">
                      <div class="row wrap">
                        <input class="mname" value={m.name} on:input={(e) => patchMode(i, m.id, { name: e.currentTarget.value })} placeholder="Mode name" />
                        <input class="mtype" value={m.attackType ?? ''} on:input={(e) => patchMode(i, m.id, { attackType: e.currentTarget.value })} placeholder="attack type" title="Attack type tag (e.g. thrust, slash) — used by scaling grants" />
                        <label class="mini">to-hit <select value={m.scaleToHit} on:change={(e) => patchMode(i, m.id, { scaleToHit: asStat(e.currentTarget.value) })}><option value="">default</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}</select></label>
                        <label class="mini">dmg <select value={m.scaleDamage} on:change={(e) => patchMode(i, m.id, { scaleDamage: asStat(e.currentTarget.value) })}><option value="">none</option>{#each CORE_STATS as s}<option value={s}>{s}</option>{/each}</select></label>
                        <label class="mini">to-hit+ <input class="num" type="number" value={m.toHitBonus} on:input={(e) => patchMode(i, m.id, { toHitBonus: Math.round(Number(e.currentTarget.value)) })} /></label>
                        <button class="ghost small" on:click={() => removeMode(i, m.id)}>✕ mode</button>
                      </div>
                      {#if i.tags.includes('two-handed')}
                        <span class="dmglabel faint small">1H damage</span>
                      {/if}
                      <div class="terms">
                        {#each m.damage as t (t.id)}
                          <span class="term">
                            <input class="not" value={t.notation} on:input={(e) => patchTerm(i, m.id, t.id, { notation: e.currentTarget.value })} placeholder="2d6" />
                            <select value={t.typeId} on:change={(e) => patchTerm(i, m.id, t.id, { typeId: e.currentTarget.value })}>{#each damageTypes as d}<option value={d.id}>{d.name}</option>{/each}</select>
                            <button class="x" on:click={() => removeTerm(i, m.id, t.id)}>×</button>
                          </span>
                        {/each}
                        <button class="small" on:click={() => addTerm(i, m.id)}>+ {i.tags.includes('two-handed') ? '1H term' : 'term'}</button>
                      </div>
                      {#if i.tags.includes('two-handed')}
                        <span class="dmglabel faint small">2H damage</span>
                        <div class="terms">
                          {#each m.damageTwoHanded ?? [] as t (t.id)}
                            <span class="term">
                              <input class="not" value={t.notation} on:input={(e) => patchTermTwoHanded(i, m.id, t.id, { notation: e.currentTarget.value })} placeholder="2d6" />
                              <select value={t.typeId} on:change={(e) => patchTermTwoHanded(i, m.id, t.id, { typeId: e.currentTarget.value })}>{#each damageTypes as d}<option value={d.id}>{d.name}</option>{/each}</select>
                              <button class="x" on:click={() => removeTermTwoHanded(i, m.id, t.id)}>×</button>
                            </span>
                          {/each}
                          <button class="small" on:click={() => addTermTwoHanded(i, m.id)}>+ 2H term</button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                {/if}
              </div>

              <button class="danger small" on:click={() => remove(i.id)}>Delete item</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</section>

{#if showAdd}
  <Modal title="New item" on:close={() => (showAdd = false)}>
    <div class="f"><label>Name</label><input bind:value={addName} placeholder="Item name" autofocus /></div>
    <div class="f" style="margin-top:.5rem"><label>Category</label><input list="addcats" bind:value={addCat} placeholder={cats[0] ?? 'Gear'} /><datalist id="addcats">{#each cats as c}<option value={c}></option>{/each}</datalist></div>
    <svelte:fragment slot="footer">
      <button on:click={() => (showAdd = false)}>Cancel</button>
      <button class="primary" on:click={addItem}>Create</button>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  section.panel { display: flex; flex-direction: column; gap: 0.6rem; }
  .search { max-width: 360px; }
  .types { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .trow { display: flex; gap: 0.4rem; align-items: center; }
  .trow input[type='text'], .trow input:not([type]) { flex: 1; }
  .catsec { display: flex; flex-direction: column; gap: 0.3rem; }
  .cathead { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); border-bottom: 1px solid var(--border); padding-bottom: 0.2rem; }
  .item { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
  .namerow { width: 100%; text-align: left; background: transparent; border: none; display: flex; gap: 0.5rem; align-items: baseline; padding: 0.45rem 0.6rem; }
  .namerow:hover { background: var(--bg-3); }
  .detail { padding: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border); }
  .grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f select { width: 100%; }
  .weapon { border-top: 1px solid var(--border); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .mode { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .mname { width: 140px; }
  .mtype { width: 100px; }
  .mini { font-size: 0.78em; display: flex; gap: 0.2rem; align-items: center; }
  .num { width: 56px; }
  .dmglabel { display: block; margin-top: 0.2rem; }
  .terms { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
  .term { display: inline-flex; gap: 0.2rem; align-items: center; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.15rem 0.3rem; }
  .term .not { width: 64px; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; }
  .small { font-size: 0.85em; }
</style>
