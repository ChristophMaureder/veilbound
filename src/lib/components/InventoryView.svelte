<script lang="ts">
  import {
    activeCharacter, ruleset as rulesetStore, derivedActive,
    addItemToInventory, removeInventoryEntry, patchInventoryEntry,
    addBag, renameBag, deleteBag, moveBagToColumn, reorderBagIntoColumn,
  } from '../stores';
  import { ghostDragStart, ghostDragMove, ghostDragEnd } from '../dragGhost';
  import type { InventoryEntry, ItemDef, Grant } from '../types';
  import Modal from './Modal.svelte';
  import WeaponsBox from './WeaponsBox.svelte';

  $: character = $activeCharacter;
  $: derived = $derivedActive;

  // Column count — persisted in localStorage
  function loadCols(): number {
    try { return Math.max(1, Math.min(6, Number(localStorage.getItem('vb.invCols') ?? '2') || 2)); }
    catch { return 2; }
  }
  let numCols: number = loadCols();
  $: { try { localStorage.setItem('vb.invCols', String(numCols)); } catch { /* */ } }

  let itemDragging: string[] = [];
  let expanded: string | null = null;
  let bagSearch: Record<string, string> = {};
  let filterTag = '';
  let filterCat = '';
  let newBag = '';
  let showShop = false;
  let shopQuery = '';
  let shopCat = '';
  let shopTag = '';
  let shopLevel = '';

  // Bag mouse-drag state
  let bagDragId: string | null = null;
  let bagGhostX = 0;
  let bagGhostY = 0;
  let bagGhostW = 240;
  let bagGhostName = '';
  let bagDropBag: string | null = null;
  let bagDropCol: number | null = null;

  function bagHandleDown(e: MouseEvent, bagId: string, bagName: string) {
    e.preventDefault();
    bagDragId = bagId;
    bagGhostName = bagName;
    bagGhostX = e.clientX;
    bagGhostY = e.clientY;
    const container = (e.currentTarget as HTMLElement).closest<HTMLElement>('.container');
    bagGhostW = container?.offsetWidth ?? 260;
    bagDropBag = null;
    bagDropCol = null;
  }

  function onWinMouseMove(e: MouseEvent) {
    if (!bagDragId) return;
    bagGhostX = e.clientX;
    bagGhostY = e.clientY;
    const hits = document.elementsFromPoint(e.clientX, e.clientY);
    // Skip the source bag so leftward drags work (the source stays rendered at 35% opacity)
    const bagEl = hits.find((el) => {
      const id = (el as HTMLElement).dataset.bagId;
      return id && id !== bagDragId;
    }) as HTMLElement | undefined;
    // Always track hovered column so the dashed outline covers the entire column zone
    const colEl = hits.find((el) => (el as HTMLElement).dataset.colIdx !== undefined) as HTMLElement | undefined;
    bagDropBag = bagEl?.dataset.bagId ?? null;
    bagDropCol = colEl?.dataset.colIdx !== undefined ? Number(colEl.dataset.colIdx) : null;
  }

  function onWinMouseUp() {
    if (bagDragId) {
      if (bagDropBag) {
        const targetCol = (bags.find((b) => b.id === bagDropBag)?.column) ?? 0;
        reorderBagIntoColumn(bagDragId, targetCol, bagDropBag);
      } else if (bagDropCol !== null) {
        moveBagToColumn(bagDragId, bagDropCol);
      }
    }
    bagDragId = null;
    bagDropBag = null;
    bagDropCol = null;
  }

  $: items = $rulesetStore.items;
  $: ruleset = $rulesetStore;
  $: bags = (character?.bags ?? []).map((b) => ({ ...b, column: b.column ?? 0 }));

  function bagsInCol(col: number) { return bags.filter((b) => b.column === col); }
  function itemOf(id: string): ItemDef | undefined { return items.find((i) => i.id === id); }

  // Accepts inventory explicitly so Svelte tracks it as a template dependency,
  // preventing stale renders when equip state changes without bag IDs changing.
  function entriesIn(bagId: string, inv: InventoryEntry[]): { e: InventoryEntry; it: ItemDef }[] {
    const q = (bagSearch[bagId] ?? '').trim().toLowerCase();
    return inv
      .filter((e) => {
        if (e.bagId !== bagId) return false;
        const it = itemOf(e.itemId);
        if (!it) return false;
        if (q && !(it.name.toLowerCase().includes(q) || it.tags.some((t) => t.includes(q)))) return false;
        if (filterTag && !it.tags.includes(filterTag)) return false;
        if (filterCat && it.category !== filterCat) return false;
        return true;
      })
      .map((e) => ({ e, it: itemOf(e.itemId)! }));
  }

  $: allTags = [...new Set(items.flatMap((i) => i.tags))].sort();

  function startItemDrag(ev: DragEvent, entryId: string, itemName: string) {
    itemDragging = [entryId];
    ghostDragStart(ev, itemName);
  }
  function endItemDrag() { ghostDragEnd(); itemDragging = []; }
  function dropItem(bagId: string) {
    if (!itemDragging.length) return;
    ghostDragEnd(); // clear ghost before state change destroys source element
    for (const eid of itemDragging) patchInventoryEntry(eid, { bagId });
    itemDragging = [];
  }

  function grantText(g: Grant): string {
    if (g.kind === 'modifier') return `${g.mode === 'set' ? 'set ' : g.mode === 'mul' ? '×' : g.value >= 0 ? '+' : ''}${g.value} ${g.target}`;
    if (g.kind === 'resource') return `+${g.amount} ${ruleset.resources.find((r) => r.id === g.resourceId)?.label ?? g.resourceId}`;
    if (g.kind === 'ac') return `AC ${g.low}–${g.high}`;
    if (g.kind === 'scaling') return `scaling: ${g.tag}`;
    if (g.kind === 'addmode') return `adds ${g.mode.name} mode to ${g.weaponTag}`;
    return `+${g.formula} ${g.scopeValue} dmg (${g.scope})`;
  }

  $: shopTags = [...new Set(items.flatMap((i) => i.tags))].sort();
  $: shopResults = items.filter((i) => {
    const q = shopQuery.trim().toLowerCase();
    if (q && !i.name.toLowerCase().includes(q)) return false;
    if (shopCat && i.category !== shopCat) return false;
    if (shopTag && !i.tags.includes(shopTag)) return false;
    if (shopLevel.trim() && String(i.level) !== shopLevel.trim()) return false;
    return true;
  });
  function buy(itemId: string) {
    addItemToInventory(itemId, bags[bags.length - 1]?.id ?? 'bag_backpack');
  }
  function addBagInCol(col: number) {
    addBag(newBag.trim() || 'Bag', col);
    newBag = '';
  }
</script>

<svelte:window on:mousemove={onWinMouseMove} on:mouseup={onWinMouseUp} />

{#if bagDragId}
  <div class="bag-ghost" style="left:{bagGhostX}px;top:{bagGhostY}px;width:{bagGhostW}px">
    <span class="dots">⠿</span> {bagGhostName}
  </div>
{/if}

{#if !character}
  <div class="panel"><p class="muted">No character selected.</p></div>
{:else}
  <div class="inv" class:dragging-bag={!!bagDragId}>
    <div class="toolbar panel">
      <strong>Inventory</strong>
      <span class="faint">Total load: <strong>{derived?.load.total ?? 0}</strong></span>
      <select bind:value={filterTag} title="Filter by tag"><option value="">All tags</option>{#each allTags as t}<option value={t}>{t}</option>{/each}</select>
      <select bind:value={filterCat} title="Filter by category"><option value="">All categories</option>{#each ruleset.itemCategories as c}<option value={c}>{c}</option>{/each}</select>
      <span class="spacer"></span>
      <label class="row" style="gap:.3rem;font-size:.85em">
        Columns <input type="number" min="1" max="6" style="width:3.5rem" bind:value={numCols} />
      </label>
      <input class="newbag" placeholder="New container" bind:value={newBag} on:keydown={(e) => { if (e.key === 'Enter') addBagInCol(0); }} />
      <button class="small" on:click={() => addBagInCol(0)}>+ Container</button>
      <button class="primary" on:click={() => (showShop = true)}>🛒 Shop</button>
    </div>

    <div class="col-grid" style="grid-template-columns:repeat({numCols},1fr)">
      {#each Array.from({ length: numCols }, (_, i) => i) as col (col)}
        <div class="col-zone" class:col-drop={bagDropCol === col && bagDragId !== null} data-col-idx={col}>
          {#each bagsInCol(col) as bag (bag.id)}
            {@const inv = character?.inventory ?? []}
            <div
              class="container panel"
              class:dragging-self={bagDragId === bag.id}
              class:drop-target={bagDropBag === bag.id}
              data-bag-id={bag.id}
              on:dragover|preventDefault
              on:drop|preventDefault={() => dropItem(bag.id)}
            >
              <div class="chead">
                <span class="handle" title="Drag to reposition" on:mousedown={(e) => bagHandleDown(e, bag.id, bag.name)}>⠿</span>
                <input class="bagname" value={bag.name} on:input={(e) => renameBag(bag.id, e.currentTarget.value)} />
                <span class="bw faint">{derived?.load.perBag[bag.id] ?? 0}w</span>
                {#if bags.length > 1}<button class="x" on:click={() => deleteBag(bag.id)} title="Delete">✕</button>{/if}
              </div>
              <input class="bagsearch" placeholder="Search…" value={bagSearch[bag.id] ?? ''} on:input={(e) => (bagSearch = { ...bagSearch, [bag.id]: e.currentTarget.value })} />
              <div class="rows">
                {#each entriesIn(bag.id, inv) as { e, it } (e.id)}
                  <div
                    class="entry"
                    class:equipped={e.equipped}
                    draggable="true"
                    on:dragstart={(ev) => startItemDrag(ev, e.id, it.name)}
                    on:drag={ghostDragMove}
                    on:dragend={endItemDrag}
                  >
                    <div class="erow">
                      <button class="ename" on:click={() => (expanded = expanded === e.id ? null : e.id)}>{it.name}{#if e.qty > 1} ×{e.qty}{/if}</button>
                      <span class="spacer"></span>
                      <button class="eq" class:on={e.equipped} on:click={() => patchInventoryEntry(e.id, { equipped: !e.equipped })}>{e.equipped ? '✓ Equipped' : 'Equip'}</button>
                    </div>
                    {#if expanded === e.id}
                      <div class="edetail">
                        {#if it.flavour}<p class="flavour">{it.flavour}</p>{/if}
                        {#if it.description}<p class="desc">{it.description}</p>{/if}
                        {#if it.grants.length}<div class="tags">{#each it.grants as g}<span class="pill">{grantText(g)}</span>{/each}</div>{/if}
                        {#if it.weapon}<div class="faint small">Weapon · {it.weapon.modes.map((m) => m.name).join(', ')}</div>{/if}
                        {#if it.actions.length}<div class="faint small">Actions: {it.actions.map((a) => a.name).join(', ')}</div>{/if}
                        <div class="erow2"><span class="faint small">{it.weight}w · L{it.level}</span><span class="spacer"></span><button class="x" on:click={() => removeInventoryEntry(e.id)}>Remove</button></div>
                      </div>
                    {/if}
                  </div>
                {/each}
                {#if entriesIn(bag.id, inv).length === 0}<p class="faint small">Empty. Drag items here or use the shop.</p>{/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    {#if derived && derived.weapons.length}<WeaponsBox {derived} />{/if}
  </div>
{/if}

{#if showShop}
  <Modal title="Shop" wide on:close={() => (showShop = false)}>
    <div class="shopfilters row wrap">
      <input placeholder="Name / partial…" bind:value={shopQuery} />
      <select bind:value={shopCat}><option value="">Any category</option>{#each ruleset.itemCategories as c}<option value={c}>{c}</option>{/each}</select>
      <select bind:value={shopTag}><option value="">Any tag</option>{#each shopTags as t}<option value={t}>{t}</option>{/each}</select>
      <input class="lvl" placeholder="Level" bind:value={shopLevel} />
    </div>
    <div class="shopgrid">
      {#each shopResults as i (i.id)}
        <div class="shopitem">
          <div class="row"><strong>{i.name}</strong><span class="spacer"></span><span class="faint small">L{i.level} · {i.category}</span></div>
          {#if i.flavour}<p class="flavour">{i.flavour}</p>{/if}
          {#if i.grants.length}<div class="tags">{#each i.grants as g}<span class="pill">{grantText(g)}</span>{/each}</div>{/if}
          <div class="tags">{#each i.tags as t}<span class="pill">{t}</span>{/each}</div>
          <button class="primary small" on:click={() => buy(i.id)}>+ Add to inventory</button>
        </div>
      {/each}
      {#if shopResults.length === 0}<p class="faint">No items match.</p>{/if}
    </div>
  </Modal>
{/if}

<style>
  .inv { display: flex; flex-direction: column; gap: 1rem; }
  .inv.dragging-bag { cursor: grabbing; user-select: none; }
  .toolbar { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .newbag { width: 130px; }

  .col-grid { display: grid; gap: 1rem; align-items: start; }
  .col-zone { display: flex; flex-direction: column; gap: 0.8rem; min-height: 60px; padding: 0.25rem; border-radius: var(--radius-sm); transition: background 0.1s; }
  .col-zone.col-drop { background: rgba(124, 95, 212, 0.08); outline: 2px dashed var(--accent); }

  .container { display: flex; flex-direction: column; gap: 0; transition: opacity 0.12s, outline 0.1s; }
  .container.dragging-self { opacity: 0.35; }
  .container.drop-target { outline: 2px solid var(--accent); }

  .chead { display: flex; align-items: center; gap: 0.4rem; }
  .handle { cursor: grab; color: var(--text-faint); user-select: none; padding: 0 0.15rem; }
  .handle:active { cursor: grabbing; }
  .bagname { flex: 1; font-weight: 600; background: transparent; border: none; padding: 0.2rem; }
  .bagname:focus { background: var(--bg); }
  .bw { font-size: 0.85em; }
  .bagsearch { width: 100%; margin: 0.4rem 0; }
  .rows { display: flex; flex-direction: column; gap: 0.3rem; }
  .entry { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.35rem 0.5rem; cursor: grab; }
  .entry.equipped { border-left: 3px solid var(--gold); }
  .erow { display: flex; align-items: center; gap: 0.4rem; }
  .ename { flex: 1; text-align: left; background: transparent; border: none; color: var(--text); cursor: pointer; padding: 0; }
  .eq { font-size: 0.78em; padding: 0.15em 0.5em; }
  .eq.on { background: var(--gold); color: #2a2410; border-color: var(--gold); }
  .edetail { margin-top: 0.4rem; border-top: 1px solid var(--border); padding-top: 0.4rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .flavour { font-style: italic; color: var(--text-dim); margin: 0; font-size: 0.88em; }
  .desc { margin: 0; font-size: 0.9em; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .erow2 { display: flex; align-items: center; }
  .x { background: none; border: none; color: var(--text-dim); cursor: pointer; }
  .x:hover { color: var(--bad); }
  .small { font-size: 0.85em; }
  .shopfilters { margin-bottom: 0.8rem; }
  .shopfilters .lvl { width: 80px; }
  .shopgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .shopitem { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem; }
  .shopitem button { margin-top: 0.4rem; }

  .bag-ghost {
    position: fixed; pointer-events: none; z-index: 9999;
    background: var(--bg-2); border: 2px solid var(--accent);
    border-radius: var(--radius-sm); padding: 0.45rem 0.7rem;
    font-weight: 600; opacity: 0.93;
    transform: translate(12px, -50%);
    box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    display: flex; align-items: center; gap: 6px;
  }
  .bag-ghost .dots { color: var(--text-faint); }
</style>
