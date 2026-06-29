<script lang="ts">
  import { ruleset, treeEditorUi, ensureTags, addCategory, renameCategory, deleteCategory, moveCategory } from '../../stores';
  import type { SkillNode, SkillTree, TreeRarity, TreeRequirement, TreeType } from '../../types';
  import { CORE_STATS, TREE_REQ_KINDS, TREE_REQ_KIND_LABELS } from '../../types';

  const TREE_TYPES: { value: TreeType; label: string }[] = [{ value: 'skill', label: 'Skill' }, { value: 'spell', label: 'Spell' }];
  const TREE_RARITIES: { value: TreeRarity; label: string }[] = [{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }, { value: 'legendary', label: 'Celestial' }];
  const RARITY_COLOUR: Record<TreeRarity, string> = { basic: 'var(--text-dim)', expert: '#7ec8a8', legendary: '#c8a44a' };
  import { childMap, computeLayout } from '../../engine/tree';
  import { uid } from '../../util';
  import NodeEditor from './NodeEditor.svelte';
  import TagPicker from '../TagPicker.svelte';

  $: trees = $ruleset.trees;
  $: resources = $ruleset.resources;
  $: categories = $ruleset.categories;
  $: subcategories = [...new Set(trees.map((t) => t.subcategory ?? '').filter(Boolean))].sort();

  $: selectedId = $treeEditorUi.selectedTreeId;
  $: nodeMemory = $treeEditorUi.nodeMemory;
  function setSelectedTree(id: string | null) {
    treeEditorUi.update((s) => ({ ...s, selectedTreeId: id }));
  }
  let selectedNodeId: string | null = $treeEditorUi.nodeMemory[$treeEditorUi.selectedTreeId ?? ''] ?? null;
  $: selectedNodeId = selectedId ? (nodeMemory[selectedId] ?? null) : null;
  function selectNode(id: string | null) {
    if (id !== null && selectedId) {
      treeEditorUi.update((s) => ({ ...s, nodeMemory: { ...s.nodeMemory, [selectedId!]: id! } }));
    }
    selectedNodeId = id;
  }
  let selectedEdge: { from: string; to: string } | null = null;
  let nodeMode: 'table' | 'node' = 'node';
  let search = '';
  let dragFrom: string | null = null; // node-view drag-connect source

  // Category manager (add / reorder / rename)
  let manageCats = false;
  let newCat = '';
  // Rank a category by its position in the known-list; unknown ones sort last.
  $: catRank = (c: string) => { const i = categories.indexOf(c); return i < 0 ? categories.length + 1 : i; };
  function addCat() { const v = newCat.trim(); if (v) { addCategory(v); newCat = ''; } }
  // Category combobox
  let catQ = ''; let catQOpen = false;
  $: catQMatches = (() => {
    const q = catQ.trim().toLowerCase();
    return categories.filter((c) => !q || c.toLowerCase().includes(q));
  })();

  // Subcategory combobox
  let subcatQ = ''; let subcatQOpen = false;
  $: subcatQMatches = (() => {
    const q = subcatQ.trim().toLowerCase();
    return subcategories.filter((s) => !q || s.toLowerCase().includes(q));
  })();

  // Sub-subcategory combobox
  $: subcategories2 = [...new Set(trees.map((t) => t.subcategory2 ?? '').filter(Boolean))].sort();
  let subcat2Q = ''; let subcat2QOpen = false;
  $: subcat2QMatches = (() => {
    const q = subcat2Q.trim().toLowerCase();
    return subcategories2.filter((s) => !q || s.toLowerCase().includes(q));
  })();

  $: shown = trees.filter((t) => {
    const q = search.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.tags.some((x) => x.includes(q));
  });
  // Three-level grouping: category → subcategory → sub-subcategory.
  type Sub2Group = { sub2: string; trees: SkillTree[] };
  type SubGroup = { sub: string; direct: SkillTree[]; sub2s: Sub2Group[] };
  type CatGroup = { cat: string; direct: SkillTree[]; subs: SubGroup[] };
  $: byCategory = (() => {
    const m = new Map<string, { direct: SkillTree[]; subMap: Map<string, { direct: SkillTree[]; sub2Map: Map<string, SkillTree[]> }> }>();
    for (const t of shown) {
      const c = t.category || 'Uncategorised';
      if (!m.has(c)) m.set(c, { direct: [], subMap: new Map() });
      const entry = m.get(c)!;
      const sub = (t.subcategory ?? '').trim();
      if (sub) {
        if (!entry.subMap.has(sub)) entry.subMap.set(sub, { direct: [], sub2Map: new Map() });
        const subEntry = entry.subMap.get(sub)!;
        const sub2 = (t.subcategory2 ?? '').trim();
        if (sub2) {
          if (!subEntry.sub2Map.has(sub2)) subEntry.sub2Map.set(sub2, []);
          subEntry.sub2Map.get(sub2)!.push(t);
        } else {
          subEntry.direct.push(t);
        }
      } else {
        entry.direct.push(t);
      }
    }
    const byName = (a: SkillTree, b: SkillTree) => a.name.localeCompare(b.name);
    return [...m.entries()]
      .map(([cat, { direct, subMap }]): CatGroup => ({
        cat,
        direct: [...direct].sort(byName),
        subs: [...subMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sub, { direct: sd, sub2Map }]): SubGroup => ({
          sub,
          direct: [...sd].sort(byName),
          sub2s: [...sub2Map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sub2, ts]) => ({ sub2, trees: [...ts].sort(byName) })),
        })),
      }))
      .sort((a, b) => catRank(a.cat) - catRank(b.cat));
  })();

  $: if (selectedId === null && trees.length) setSelectedTree(trees[0].id);
  $: selected = trees.find((t) => t.id === selectedId) ?? null;
  $: selectedNode = selected?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  function toRoman(n: number): string {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let r = ''; for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } return r;
  }
  function computeDisplayNames(nodes: SkillNode[]): Map<string, string> {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // For each node, compute the set of all ancestor node IDs (transitive prereqs).
    const ancestorCache = new Map<string, Set<string>>();
    function ancestors(id: string, stack = new Set<string>()): Set<string> {
      if (ancestorCache.has(id)) return ancestorCache.get(id)!;
      if (stack.has(id)) return new Set();
      stack.add(id);
      const node = byId.get(id);
      const out = new Set<string>();
      for (const p of node?.prereqNodeIds ?? []) {
        out.add(p);
        for (const a of ancestors(p, stack)) out.add(a);
      }
      ancestorCache.set(id, out);
      return out;
    }
    for (const n of nodes) ancestors(n.id);
    // Only add numerals to names that appear more than once in the tree.
    const totalCount = new Map<string, number>();
    for (const n of nodes) totalCount.set(n.name, (totalCount.get(n.name) ?? 0) + 1);
    // Each node's numeral = 1 + number of ancestors with the same name.
    const out = new Map<string, string>();
    for (const n of nodes) {
      if ((totalCount.get(n.name) ?? 1) > 1) {
        const ancs = ancestorCache.get(n.id) ?? new Set();
        const prior = [...ancs].filter((a) => byId.get(a)?.name === n.name).length;
        out.set(n.id, `${n.name} ${toRoman(prior + 1)}`);
      } else {
        out.set(n.id, n.name || n.id);
      }
    }
    return out;
  }
  $: displayNames = computeDisplayNames(selected?.nodes ?? []);
  function nameLabel(n: SkillNode): string { return displayNames.get(n.id) ?? (n.name || n.id); }
  // All attackmod modifiers in the current tree — passed to NodeEditor for the "replaces" dropdown.
  $: treeModifiers = (selected?.nodes ?? []).flatMap((n) =>
    n.grants.filter((g) => g.kind === 'attackmod').map((g) => ({ id: (g as any).modifier.id as string, name: (g as any).modifier.name as string }))
  );
  $: kids = selected ? childMap(selected) : new Map<string, string[]>();
  $: layout = selected ? computeLayout(selected) : null;

  function updateTree(id: string, patch: Partial<SkillTree>) {
    ruleset.update((rs) => ({ ...rs, trees: rs.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }
  function progressionCost(treeType: TreeType, rarity: TreeRarity, depth: number): number {
    const arr = $ruleset.treeProgressionCosts?.[treeType]?.[rarity] ?? [];
    const idx = Math.min(depth, arr.length - 1);
    return arr[idx] ?? 2;
  }
  function applyProgressionCosts() {
    if (!selected || !layout) return;
    const type = selected.treeType ?? 'skill';
    const rar = selected.rarity ?? 'basic';
    setNodes(selected.nodes.map((n) => ({ ...n, cost: progressionCost(type, rar, layout!.pos.get(n.id)?.depth ?? 0) })));
  }

  function addTree() {
    const type: TreeType = 'skill';
    const rar: TreeRarity = 'basic';
    const rootCost = progressionCost(type, rar, 0);
    const t: SkillTree = { id: uid('tree'), name: 'New Tree', description: '', tags: [], category: categories[0] ?? 'Combat', status: 'inProgress', treeType: type, rarity: rar,
      nodes: [{ id: uid('node'), name: 'Start', cost: rootCost, description: '', prerequisite: '', prereqNodeIds: [], exclusive: false, actions: [], grants: [], hideName: false, hideDescription: false, hidePrerequisite: false }] };
    ruleset.update((rs) => ({ ...rs, trees: [...rs.trees, t] }));
    setSelectedTree(t.id);
    selectNode(t.nodes[0].id);
  }
  function deleteTree(id: string) {
    ruleset.update((rs) => ({ ...rs, trees: rs.trees.filter((t) => t.id !== id) }));
    setSelectedTree(null);
  }
  function setNodes(nodes: SkillNode[]) {
    if (selected) updateTree(selected.id, { nodes });
  }
  function updateNode(next: SkillNode) {
    if (selected) setNodes(selected.nodes.map((n) => (n.id === next.id ? next : n)));
  }
  function removeNode(id: string) {
    if (!selected) return;
    setNodes(selected.nodes.filter((n) => n.id !== id).map((n) => ({ ...n, prereqNodeIds: n.prereqNodeIds.filter((p) => p !== id) })));
    if (selectedNodeId === id) selectNode(null);
  }
  function addNode(parentId: string | null) {
    if (!selected) return;
    const parentDepth = parentId ? (layout?.pos.get(parentId)?.depth ?? 0) : -1;
    const depth = parentDepth + 1;
    const type = selected.treeType ?? 'skill';
    const rar = selected.rarity ?? 'basic';
    const cost = progressionCost(type, rar, depth);
    const n: SkillNode = { id: uid('node'), name: 'New Node', cost, description: '', prerequisite: '', prereqNodeIds: parentId ? [parentId] : [], exclusive: false, actions: [], grants: [], hideName: false, hideDescription: false, hidePrerequisite: false };
    setNodes([...selected.nodes, n]);
    selectNode(n.id);
  }
  // Connection = source leads to target (source becomes a prerequisite of target).
  function connect(source: string, target: string) {
    if (!selected || source === target) return;
    setNodes(selected.nodes.map((n) => (n.id === target && !n.prereqNodeIds.includes(source) ? { ...n, prereqNodeIds: [...n.prereqNodeIds, source] } : n)));
  }
  function disconnect(source: string, target: string) {
    if (!selected) return;
    setNodes(selected.nodes.map((n) => (n.id === target ? { ...n, prereqNodeIds: n.prereqNodeIds.filter((p) => p !== source) } : n)));
  }
  function nameOf(id: string): string {
    return displayNames.get(id) ?? selected?.nodes.find((n) => n.id === id)?.name ?? id;
  }

  // ── Tree requirements (gate) ──────────────────────────────────────────────
  function setReqs(reqs: TreeRequirement[]) { if (selected) updateTree(selected.id, { requirements: reqs }); }
  function addReq(kind: TreeRequirement['kind']) {
    if (!selected) return;
    let r: TreeRequirement;
    if (kind === 'treeLevel') r = { id: uid('req'), kind, treeId: trees.find((t) => t.id !== selected!.id)?.id ?? '', min: 1 };
    else if (kind === 'subcatLevel') r = { id: uid('req'), kind, subcategory: subcategories[0] ?? '', level: 1, count: 1 };
    else r = { id: uid('req'), kind, stat: 'STR', min: 10 };
    setReqs([...(selected.requirements ?? []), r]);
  }
  function patchReq(id: string, patch: Record<string, unknown>) {
    if (!selected) return;
    setReqs((selected.requirements ?? []).map((r) => (r.id === id ? ({ ...r, ...patch } as TreeRequirement) : r)));
  }
  function removeReq(id: string) {
    if (!selected) return;
    setReqs((selected.requirements ?? []).filter((r) => r.id !== id));
  }

  // node-view layout pixels
  const LANE = 90, ROW = 55, PAD = 36;
  const isMilestone = (depth: number) => depth === 0 || (depth + 1) % 5 === 0;
  $: minX = layout ? Math.min(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  $: maxX = layout ? Math.max(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  const px = (x: number) => (x - minX) * LANE + PAD;
  const py = (d: number) => d * ROW + PAD;
</script>

<div class="te">
  <aside class="list panel">
    <div class="row"><strong>Trees</strong><span class="spacer"></span>
      <button class="small" class:active={manageCats} on:click={() => (manageCats = !manageCats)} title="Add & reorder categories">⚙ Categories</button>
      <button class="primary small" on:click={addTree}>+ Tree</button></div>

    {#if manageCats}
      <div class="catmgr">
        <p class="faint small" style="margin:0 0 .2rem">Order here sets the order categories appear in — here and for players.</p>
        {#each categories as c, i (c)}
          <div class="catrow">
            <input class="catname-in" value={c} on:change={(e) => renameCategory(c, e.currentTarget.value)} />
            <button class="mv" disabled={i === 0} on:click={() => moveCategory(c, -1)} title="Move up">↑</button>
            <button class="mv" disabled={i === categories.length - 1} on:click={() => moveCategory(c, 1)} title="Move down">↓</button>
            <button class="x" on:click={() => deleteCategory(c)} title="Remove from list (trees keep the name)">×</button>
          </div>
        {/each}
        <div class="catadd">
          <input placeholder="New category…" bind:value={newCat} on:keydown={(e) => { if (e.key === 'Enter') addCat(); }} />
          <button class="small" on:click={addCat}>Add</button>
        </div>
      </div>
    {/if}

    <input class="search" placeholder="Search trees…" bind:value={search} />
    <div class="treelist scrollbar">
      {#each byCategory as grp (grp.cat)}
        <div class="catgroup">
          <div class="catname">{grp.cat}</div>
          {#each grp.direct as t (t.id)}
            <button class="titem" class:active={t.id === selectedId} on:click={() => { setSelectedTree(t.id); selectedNodeId = nodeMemory[t.id] ?? null; }}>
              <span class="tn">{t.name}</span>
              <span class="tr-badges">
                <span class="tr-type">{t.treeType === 'spell' ? 'sp' : 'sk'}</span>
                <span class="tr-rar" style="color:{RARITY_COLOUR[t.rarity ?? 'basic']}">{(t.rarity ?? 'basic').slice(0,3)}</span>
                <span class="st {t.status}">{t.status === 'done' ? '✓' : 'wip'}</span>
              </span>
            </button>
          {/each}
          {#each grp.subs as sg (sg.sub)}
            <div class="subgroup">
              <div class="subname">{sg.sub}</div>
              {#each sg.direct as t (t.id)}
                <button class="titem" class:active={t.id === selectedId} on:click={() => { setSelectedTree(t.id); selectedNodeId = nodeMemory[t.id] ?? null; }}>
                  <span class="tn">{t.name}</span>
                  <span class="tr-badges">
                    <span class="tr-type">{t.treeType === 'spell' ? 'sp' : 'sk'}</span>
                    <span class="tr-rar" style="color:{RARITY_COLOUR[t.rarity ?? 'basic']}">{(t.rarity ?? 'basic').slice(0,3)}</span>
                    <span class="st {t.status}">{t.status === 'done' ? '✓' : 'wip'}</span>
                  </span>
                </button>
              {/each}
              {#each sg.sub2s as sg2 (sg2.sub2)}
                <div class="subgroup2">
                  <div class="sub2name">{sg2.sub2}</div>
                  {#each sg2.trees as t (t.id)}
                    <button class="titem" class:active={t.id === selectedId} on:click={() => { setSelectedTree(t.id); selectedNodeId = nodeMemory[t.id] ?? null; }}>
                      <span class="tn">{t.name}</span>
                      <span class="tr-badges">
                        <span class="tr-type">{t.treeType === 'spell' ? 'sp' : 'sk'}</span>
                        <span class="tr-rar" style="color:{RARITY_COLOUR[t.rarity ?? 'basic']}">{(t.rarity ?? 'basic').slice(0,3)}</span>
                        <span class="st {t.status}">{t.status === 'done' ? '✓' : 'wip'}</span>
                      </span>
                    </button>
                  {/each}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </aside>

  <div class="edit">
    {#if !selected}
      <p class="faint">Select or create a tree.</p>
    {:else}
      <section class="panel">
        <div class="grid">
          <div class="f"><label>Name</label><input value={selected.name} on:input={(e) => updateTree(selected.id, { name: e.currentTarget.value })} /></div>
          <div class="f"><label>Category</label>
            <div class="combo">
              <input value={selected.category}
                on:input={(e) => { catQ = e.currentTarget.value; updateTree(selected.id, { category: e.currentTarget.value }); }}
                on:focus={() => { catQ = selected?.category ?? ''; catQOpen = true; }}
                on:blur={() => setTimeout(() => (catQOpen = false), 150)}
              />
              {#if catQOpen}
                <div class="menu">
                  {#each catQMatches as c}
                    <button class="opt" on:click={() => { updateTree(selected.id, { category: c }); catQOpen = false; }}>{c}</button>
                  {/each}
                  {#if catQ.trim() && !categories.some((c) => c.toLowerCase() === catQ.trim().toLowerCase())}
                    <button class="opt opt-create" on:click={() => { const v = catQ.trim(); addCategory(v); updateTree(selected.id, { category: v }); catQOpen = false; }}>Create "{catQ.trim()}"</button>
                  {/if}
                </div>
              {/if}
            </div></div>
          <div class="f"><label>Subcategory <span class="faint" style="font-size:.85em">(optional)</span></label>
            <div class="combo">
              <input value={selected.subcategory ?? ''} placeholder="— none —"
                on:input={(e) => { subcatQ = e.currentTarget.value; updateTree(selected.id, { subcategory: e.currentTarget.value.trim() || undefined }); }}
                on:focus={() => { subcatQ = selected?.subcategory ?? ''; subcatQOpen = true; }}
                on:blur={() => setTimeout(() => (subcatQOpen = false), 150)}
                on:keydown={(e) => { if (e.key === 'Escape') { subcatQOpen = false; } }}
              />
              {#if subcatQOpen}
                <div class="menu">
                  <button class="opt opt-dim" on:click={() => { updateTree(selected.id, { subcategory: undefined }); subcatQOpen = false; }}>— none —</button>
                  {#each subcatQMatches as s}
                    <button class="opt" on:click={() => { updateTree(selected.id, { subcategory: s }); subcatQOpen = false; }}>{s}</button>
                  {/each}
                  {#if subcatQ.trim() && !subcatQMatches.some((s) => s.toLowerCase() === subcatQ.trim().toLowerCase())}
                    <button class="opt opt-create" on:click={() => { updateTree(selected.id, { subcategory: subcatQ.trim() }); subcatQOpen = false; }}>Create "{subcatQ.trim()}"</button>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          <div class="f"><label>Sub-subcategory <span class="faint" style="font-size:.85em">(optional)</span></label>
            <div class="combo">
              <input value={selected.subcategory2 ?? ''} placeholder="— none —"
                on:input={(e) => { subcat2Q = e.currentTarget.value; updateTree(selected.id, { subcategory2: e.currentTarget.value.trim() || undefined }); }}
                on:focus={() => { subcat2Q = selected?.subcategory2 ?? ''; subcat2QOpen = true; }}
                on:blur={() => setTimeout(() => (subcat2QOpen = false), 150)}
              />
              {#if subcat2QOpen}
                <div class="menu">
                  <button class="opt opt-dim" on:click={() => { updateTree(selected.id, { subcategory2: undefined }); subcat2QOpen = false; }}>— none —</button>
                  {#each subcat2QMatches as s}
                    <button class="opt" on:click={() => { updateTree(selected.id, { subcategory2: s }); subcat2QOpen = false; }}>{s}</button>
                  {/each}
                  {#if subcat2Q.trim() && !subcat2QMatches.some((s) => s.toLowerCase() === subcat2Q.trim().toLowerCase())}
                    <button class="opt opt-create" on:click={() => { updateTree(selected.id, { subcategory2: subcat2Q.trim() }); subcat2QOpen = false; }}>Create "{subcat2Q.trim()}"</button>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          <div class="f"><label>Status</label>
            <select value={selected.status} on:change={(e) => updateTree(selected.id, { status: e.currentTarget.value === 'done' ? 'done' : 'inProgress' })}>
              <option value="inProgress">In progress (hidden from players)</option>
              <option value="done">Done (visible to players)</option>
            </select></div>
          <div class="f"><label>Type</label>
            <select value={selected.treeType ?? 'skill'} on:change={(e) => updateTree(selected.id, { treeType: e.currentTarget.value === 'spell' ? 'spell' : 'skill' })}>
              {#each TREE_TYPES as t}<option value={t.value}>{t.label}</option>{/each}
            </select></div>
          <div class="f"><label>Rarity</label>
            <div class="row" style="gap:.35rem;align-items:center">
              <select value={selected.rarity ?? 'basic'} on:change={(e) => { const v = e.currentTarget.value; updateTree(selected.id, { rarity: v === 'legendary' ? 'legendary' : v === 'expert' ? 'expert' : 'basic' }); }}
                style="color:{RARITY_COLOUR[selected.rarity ?? 'basic']};flex:1">
                {#each TREE_RARITIES as r}<option value={r.value} style="color:{RARITY_COLOUR[r.value]}">{r.label}</option>{/each}
              </select>
              <button class="small" title="Apply default costs for this type × rarity to every node (based on depth)" on:click={applyProgressionCosts}>Apply costs</button>
            </div></div>
        </div>
        <div class="f"><label>Description</label><textarea value={selected.description} on:input={(e) => updateTree(selected.id, { description: e.currentTarget.value })}></textarea></div>
        <div class="f"><label>Tags</label><TagPicker selected={selected.tags} available={$ruleset.tags} on:change={(e) => updateTree(selected.id, { tags: e.detail })} on:create={(e) => ensureTags([e.detail])} /></div>

        <div class="reqedit">
          <div class="row wrap" style="align-items:center;gap:.4rem">
            <label style="margin:0">Requirements <span class="faint" style="font-size:.85em">(lock the tree until met; player can override)</span></label>
            <span class="spacer"></span>
            {#each TREE_REQ_KINDS as k}<button class="small" on:click={() => addReq(k)}>+ {TREE_REQ_KIND_LABELS[k]}</button>{/each}
          </div>
          {#each selected.requirements ?? [] as r (r.id)}
            <div class="reqrow">
              {#if r.kind === 'treeLevel'}
                <span class="faint small">≥</span>
                <input class="num" type="number" min="1" value={r.min} on:input={(e) => patchReq(r.id, { min: Math.max(1, Math.round(+e.currentTarget.value)) })} />
                <span class="faint small">owned nodes in</span>
                <select value={r.treeId} on:change={(e) => patchReq(r.id, { treeId: e.currentTarget.value })}>
                  {#each trees.filter((t) => t.id !== selected.id) as t}<option value={t.id}>{t.name}</option>{/each}
                </select>
              {:else if r.kind === 'subcatLevel'}
                <span class="faint small">≥</span>
                <input class="num" type="number" min="1" value={r.count} on:input={(e) => patchReq(r.id, { count: Math.max(1, Math.round(+e.currentTarget.value)) })} />
                <span class="faint small">trees in</span>
                <input class="sub" list="subcats" value={r.subcategory} on:input={(e) => patchReq(r.id, { subcategory: e.currentTarget.value })} placeholder="subcategory" />
                <span class="faint small">at level ≥</span>
                <input class="num" type="number" min="1" value={r.level} on:input={(e) => patchReq(r.id, { level: Math.max(1, Math.round(+e.currentTarget.value)) })} />
              {:else}
                <span class="faint small">≥</span>
                <input class="num" type="number" value={r.min} on:input={(e) => patchReq(r.id, { min: Math.round(+e.currentTarget.value) })} />
                <select value={r.stat} on:change={(e) => patchReq(r.id, { stat: e.currentTarget.value })}>
                  {#each CORE_STATS as s}<option value={s}>{s}</option>{/each}
                </select>
              {/if}
              <span class="spacer"></span>
              <button class="x" on:click={() => removeReq(r.id)}>×</button>
            </div>
          {/each}
        </div>

        <button class="danger small" on:click={() => deleteTree(selected.id)}>Delete tree</button>
      </section>

      <section class="panel">
        <div class="row wrap">
          <h3 style="margin:0">Nodes</h3>
          <div class="modeswitch"><button class:active={nodeMode === 'node'} on:click={() => (nodeMode = 'node')}>Node</button><button class:active={nodeMode === 'table'} on:click={() => (nodeMode = 'table')}>Table</button></div>
          <span class="spacer"></span>
          <button class="small" on:click={() => addNode(selectedNode ? selectedNode.id : null)}>{selectedNode ? '+ Add child of selected' : '+ Add root node'}</button>
        </div>

        {#if selectedNode}
          <h4 style="margin:.2rem 0 .5rem">Editing: {nameLabel(selectedNode)}</h4>
          <NodeEditor node={selectedNode} {resources} {treeModifiers} canBranch={(kids.get(selectedNode.id) ?? []).length >= 2} treeType={selected?.treeType ?? 'skill'}
            on:change={(e) => updateNode(e.detail)} on:remove={() => removeNode(selectedNode.id)} />
        {:else}
          <p class="faint">Select a node to edit it.</p>
        {/if}
      </section>
    {/if}
  </div>

  <div class="canvas-pane">
    {#if selected}
      {#if selectedEdge}
        <div class="edge-ctrl">
          <span class="faint small">Edge: <strong>{nameOf(selectedEdge.from)}</strong> → <strong>{nameOf(selectedEdge.to)}</strong></span>
          <button class="danger small" on:click={() => { const e = selectedEdge; if (e) { disconnect(e.from, e.to); selectedEdge = null; } }}>Delete connection</button>
          <button class="small" on:click={() => (selectedEdge = null)}>Cancel</button>
        </div>
      {/if}
      {#if nodeMode === 'node'}
        <p class="faint small" style="margin:0 0 .3rem">Drag node → node to connect. Click edge to delete.</p>
        <div class="canvas-wrap">
          <div class="canvas" style="width:{(maxX - minX) * LANE + PAD * 2}px; height:{(layout?.maxDepth ?? 0) * ROW + PAD * 2}px">
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <svg width={(maxX - minX) * LANE + PAD * 2} height={(layout?.maxDepth ?? 0) * ROW + PAD * 2}>
              {#each selected.nodes as n}
                {#each n.prereqNodeIds as p}
                  {@const pp = layout?.pos.get(p)}
                  {@const np = layout?.pos.get(n.id)}
                  {#if pp && np}
                    {@const isSel = selectedEdge?.from === p && selectedEdge?.to === n.id}
                    <g class="edge-g" on:click|stopPropagation={() => { selectedEdge = isSel ? null : { from: p, to: n.id }; selectNode(null); }}>
                      <line x1={px(pp.x)} y1={py(pp.depth)} x2={px(np.x)} y2={py(np.depth)} stroke="transparent" stroke-width="12" style="cursor:pointer" />
                      <line x1={px(pp.x)} y1={py(pp.depth)} x2={px(np.x)} y2={py(np.depth)} stroke={isSel ? 'var(--bad)' : 'var(--border-2)'} stroke-width={isSel ? 3 : 2} />
                    </g>
                  {/if}
                {/each}
              {/each}
            </svg>
            {#each selected.nodes as n (n.id)}
              {@const p = layout?.pos.get(n.id)}
              {#if p}
                <button class="gn" class:sel={n.id === selectedNodeId} class:milestone={isMilestone(p.depth)} style="left:{px(p.x)}px; top:{py(p.depth)}px"
                  draggable="true"
                  on:click={() => selectNode(n.id)}
                  on:dragstart={() => (dragFrom = n.id)}
                  on:dragover|preventDefault
                  on:drop|preventDefault={() => { if (dragFrom) connect(dragFrom, n.id); dragFrom = null; }}>{nameLabel(n).slice(0, 12)}</button>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div class="tablewrap scrollbar">
          <table>
            <thead><tr><th>Name</th><th>Cost</th><th>Leads to</th><th></th></tr></thead>
            <tbody>
              {#each selected.nodes as n (n.id)}
                <tr class:sel={n.id === selectedNodeId} on:click={() => selectNode(n.id)}>
                  <td>{nameLabel(n)}</td>
                  <td>{n.cost}</td>
                  <td class="leads">
                    {#each kids.get(n.id) ?? [] as c}
                      <span class="pill">{nameOf(c)}<button class="x" on:click|stopPropagation={() => disconnect(n.id, c)}>×</button></span>
                    {/each}
                    <select on:click|stopPropagation on:change={(e) => { if (e.currentTarget.value) { connect(n.id, e.currentTarget.value); e.currentTarget.value = ''; } }}>
                      <option value="">+ leads to…</option>
                      {#each selected.nodes.filter((x) => x.id !== n.id && !(kids.get(n.id) ?? []).includes(x.id)) as x}<option value={x.id}>{x.name || x.id}</option>{/each}
                    </select>
                  </td>
                  <td><button class="ghost small" on:click|stopPropagation={() => removeNode(n.id)}>✕</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .te { display: grid; grid-template-columns: 240px minmax(0, 1fr) 420px; gap: 1rem; align-items: start; }
  .list { position: sticky; top: 70px; display: flex; flex-direction: column; gap: 0.4rem; max-height: 88vh; }
  .search { width: 100%; }
  .treelist { display: flex; flex-direction: column; gap: 0.5rem; overflow: auto; }
  .catgroup { display: flex; flex-direction: column; gap: 0.2rem; }
  .catname { font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); }
  .subgroup { display: flex; flex-direction: column; gap: 0.2rem; margin-left: 0.5rem; padding-left: 0.4rem; border-left: 1px solid var(--border); }
  .subname { font-size: 0.68em; letter-spacing: 0.03em; color: var(--text-faint); font-style: italic; }
  .subgroup2 { display: flex; flex-direction: column; gap: 0.2rem; margin-left: 0.5rem; padding-left: 0.4rem; border-left: 1px dashed var(--border); }
  .sub2name { font-size: 0.64em; letter-spacing: 0.02em; color: var(--text-faint); opacity: 0.7; font-style: italic; }
  .catmgr { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.5rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
  .catrow { display: flex; align-items: center; gap: 0.2rem; }
  .catrow .catname-in { flex: 1; min-width: 0; }
  .catrow .mv { padding: 0.1em 0.4em; line-height: 1; }
  .catrow .mv:disabled { opacity: 0.35; cursor: default; }
  .catrow .x { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1em; padding: 0 0.2em; }
  .catadd { display: flex; gap: 0.3rem; margin-top: 0.2rem; }
  .catadd input { flex: 1; min-width: 0; }
  button.small.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .titem { display: flex; justify-content: space-between; gap: 0.4rem; text-align: left; align-items: center; }
  .titem.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .titem.active .tr-type, .titem.active .tr-rar { color: rgba(255,255,255,0.75) !important; }
  .tn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .tr-badges { display: flex; gap: 0.2rem; align-items: center; flex-shrink: 0; }
  .tr-type { font-size: 0.62em; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-faint); }
  .tr-rar { font-size: 0.62em; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .st { font-size: 0.68em; padding: 0.1em 0.4em; border-radius: 999px; }
  .st.done { background: rgba(94,201,138,0.2); color: var(--good); }
  .st.inProgress { background: rgba(224,162,58,0.18); color: var(--warn); }
  .edit { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  section.panel { display: flex; flex-direction: column; gap: 0.6rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
  .f { display: flex; flex-direction: column; gap: 2px; }
  .f input, .f select, .f textarea { width: 100%; }
  .modeswitch button { border-radius: 0; }
  .modeswitch button:first-child { border-radius: 6px 0 0 6px; }
  .modeswitch button:last-child { border-radius: 0 6px 6px 0; }
  .modeswitch button.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .edge-ctrl { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.4rem; background: rgba(224,106,106,0.08); border: 1px solid #6b2d2d; border-radius: var(--radius-sm); margin-bottom: 0.4rem; }
  .edge-g { cursor: pointer; }
  .canvas-pane { position: sticky; top: 70px; display: flex; flex-direction: column; gap: 0.4rem; }
  .canvas-wrap { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); }
  .canvas { position: relative; margin: 0 auto; }
  .gn { position: absolute; transform: translate(-50%, -50%); border-radius: 999px; padding: 0.25em 0.6em; font-size: 0.78em; white-space: nowrap; }
  .gn.sel { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .gn.milestone { font-size: 0.88em; padding: 0.35em 0.85em; font-weight: 600; border-color: var(--accent-2); }
  .tablewrap { overflow: auto; max-height: calc(100vh - 160px); }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid var(--border); padding: 0.25rem 0.4rem; text-align: left; font-size: 0.9em; }
  tbody tr { cursor: pointer; }
  tbody tr.sel { background: var(--bg-3); }
  .leads { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
  .leads .x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 0 0 0.2em; }
  .nodeedit { border-top: 1px solid var(--border); padding-top: 0.6rem; }
  .small { font-size: 0.85em; }
  .reqedit { display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid var(--border); padding-top: 0.6rem; }
  .reqrow { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.3rem 0.5rem; }
  .reqrow .num { width: 64px; }
  .reqrow .sub { width: 130px; }
  .reqrow .x { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1em; }
  .combo { position: relative; }
  .combo input { width: 100%; }
  .menu { position: absolute; left: 0; top: calc(100% + 2px); z-index: 40; min-width: 160px; max-height: 220px; overflow: auto; background: #0f0e15; border: 1px solid var(--border-2); border-radius: var(--radius-sm); box-shadow: var(--shadow); display: flex; flex-direction: column; }
  .opt { text-align: left; background: transparent; border: none; padding: 0.45em 0.7em; cursor: pointer; }
  .opt:hover { background: var(--bg-3); }
  .opt-dim { color: var(--text-faint); font-style: italic; }
  .opt-create { color: var(--accent); }
  @media (max-width: 1100px) { .te { grid-template-columns: 180px 1fr; } .canvas-pane { display: none; } }
  @media (max-width: 820px) { .te { grid-template-columns: 1fr; } .list { position: static; } }
</style>
