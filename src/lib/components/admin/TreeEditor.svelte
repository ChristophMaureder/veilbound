<script lang="ts">
  import { ruleset, ensureTags } from '../../stores';
  import type { SkillNode, SkillTree } from '../../types';
  import { childMap, computeLayout } from '../../engine/tree';
  import { uid } from '../../util';
  import NodeEditor from './NodeEditor.svelte';
  import TagPicker from '../TagPicker.svelte';

  $: trees = $ruleset.trees;
  $: resources = $ruleset.resources;
  $: categories = $ruleset.categories;
  $: subcategories = [...new Set(trees.map((t) => t.subcategory ?? '').filter(Boolean))].sort();

  let selectedId: string | null = null;
  let selectedNodeId: string | null = null;
  let selectedEdge: { from: string; to: string } | null = null;
  let nodeMode: 'table' | 'node' = 'node';
  let search = '';
  let dragFrom: string | null = null; // node-view drag-connect source
  let newSubcatMode = false;
  let newSubcatInput = '';
  function applyNewSubcat() {
    const v = newSubcatInput.trim();
    if (v && selectedId) { updateTree(selectedId, { subcategory: v }); newSubcatInput = ''; newSubcatMode = false; }
  }

  $: shown = trees.filter((t) => {
    const q = search.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.tags.some((x) => x.includes(q));
  });
  $: byCategory = (() => {
    const m = new Map<string, SkillTree[]>();
    for (const t of shown) {
      const c = t.category || 'Uncategorised';
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(t);
    }
    return [...m.entries()];
  })();

  $: if (selectedId === null && trees.length) selectedId = trees[0].id;
  $: selected = trees.find((t) => t.id === selectedId) ?? null;
  $: selectedNode = selected?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  $: kids = selected ? childMap(selected) : new Map<string, string[]>();
  $: layout = selected ? computeLayout(selected) : null;

  function updateTree(id: string, patch: Partial<SkillTree>) {
    ruleset.update((rs) => ({ ...rs, trees: rs.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }
  function addTree() {
    const t: SkillTree = { id: uid('tree'), name: 'New Skill Tree', description: '', tags: [], category: categories[0] ?? 'Combat', status: 'inProgress',
      nodes: [{ id: uid('node'), name: 'Start', cost: 2, description: '', prerequisite: '', prereqNodeIds: [], exclusive: false, actions: [], grants: [], hideName: false, hideDescription: false, hidePrerequisite: false }] };
    ruleset.update((rs) => ({ ...rs, trees: [...rs.trees, t] }));
    selectedId = t.id;
    selectedNodeId = t.nodes[0].id;
  }
  function deleteTree(id: string) {
    ruleset.update((rs) => ({ ...rs, trees: rs.trees.filter((t) => t.id !== id) }));
    selectedId = null;
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
    if (selectedNodeId === id) selectedNodeId = null;
  }
  function addNode(parentId: string | null) {
    if (!selected) return;
    const n: SkillNode = { id: uid('node'), name: 'New Node', cost: 2, description: '', prerequisite: '', prereqNodeIds: parentId ? [parentId] : [], exclusive: false, actions: [], grants: [], hideName: false, hideDescription: false, hidePrerequisite: false };
    setNodes([...selected.nodes, n]);
    selectedNodeId = n.id;
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
    return selected?.nodes.find((n) => n.id === id)?.name || id;
  }

  // node-view layout pixels
  const LANE = 130, ROW = 80, PAD = 50;
  $: minX = layout ? Math.min(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  $: maxX = layout ? Math.max(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  const px = (x: number) => (x - minX) * LANE + PAD;
  const py = (d: number) => d * ROW + PAD;
</script>

<div class="te">
  <aside class="list panel">
    <div class="row"><strong>Trees</strong><span class="spacer"></span><button class="primary small" on:click={addTree}>+ Tree</button></div>
    <input class="search" placeholder="Search trees…" bind:value={search} />
    <div class="treelist scrollbar">
      {#each byCategory as [cat, list]}
        <div class="catgroup">
          <div class="catname">{cat}</div>
          {#each list as t (t.id)}
            <button class="titem" class:active={t.id === selectedId} on:click={() => { selectedId = t.id; selectedNodeId = null; }}>
              <span class="tn">{t.name}</span>
              <span class="st {t.status}">{t.status === 'done' ? 'done' : 'wip'}</span>
            </button>
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
            <input list="cats" value={selected.category} on:input={(e) => updateTree(selected.id, { category: e.currentTarget.value })} />
            <datalist id="cats">{#each categories as c}<option value={c}></option>{/each}</datalist></div>
          <div class="f"><label>Subcategory <span class="faint" style="font-size:.85em">(optional)</span></label>
            {#if newSubcatMode}
              <div class="row" style="gap:.3rem">
                <input placeholder="Subcategory name" bind:value={newSubcatInput} on:keydown={(e) => { if (e.key === 'Enter') applyNewSubcat(); if (e.key === 'Escape') newSubcatMode = false; }} />
                <button class="small primary" on:click={applyNewSubcat}>Set</button>
                <button class="small" on:click={() => newSubcatMode = false}>×</button>
              </div>
            {:else}
              <div class="row" style="gap:.3rem">
                <select value={selected.subcategory ?? ''} on:change={(e) => updateTree(selected.id, { subcategory: e.currentTarget.value || undefined })}>
                  <option value="">— none —</option>
                  {#each subcategories as c}<option value={c}>{c}</option>{/each}
                  {#if selected.subcategory && !subcategories.includes(selected.subcategory)}<option value={selected.subcategory}>{selected.subcategory}</option>{/if}
                </select>
                <button class="small" on:click={() => { newSubcatMode = true; newSubcatInput = ''; }} title="Create new subcategory">+ New</button>
              </div>
            {/if}
          </div>
          <div class="f"><label>Status</label>
            <select value={selected.status} on:change={(e) => updateTree(selected.id, { status: e.currentTarget.value === 'done' ? 'done' : 'inProgress' })}>
              <option value="inProgress">In progress (hidden from players)</option>
              <option value="done">Done (visible to players)</option>
            </select></div>
        </div>
        <div class="f"><label>Description</label><textarea value={selected.description} on:input={(e) => updateTree(selected.id, { description: e.currentTarget.value })}></textarea></div>
        <div class="f"><label>Tags</label><TagPicker selected={selected.tags} available={$ruleset.tags} on:change={(e) => updateTree(selected.id, { tags: e.detail })} on:create={(e) => ensureTags([e.detail])} /></div>
        <button class="danger small" on:click={() => deleteTree(selected.id)}>Delete tree</button>
      </section>

      <section class="panel">
        <div class="row wrap">
          <h3 style="margin:0">Nodes</h3>
          <div class="modeswitch"><button class:active={nodeMode === 'node'} on:click={() => (nodeMode = 'node')}>Node</button><button class:active={nodeMode === 'table'} on:click={() => (nodeMode = 'table')}>Table</button></div>
          <span class="spacer"></span>
          <button class="small" on:click={() => addNode(selectedNode ? selectedNode.id : null)}>{selectedNode ? '+ Add child of selected' : '+ Add root node'}</button>
        </div>

        {#if nodeMode === 'node'}
          <p class="faint small">Drag from one node onto another to connect them. Click an edge line to select it, then delete.</p>
          {#if selectedEdge}
            <div class="edge-ctrl">
              <span class="faint small">Edge: <strong>{nameOf(selectedEdge.from)}</strong> → <strong>{nameOf(selectedEdge.to)}</strong></span>
              <button class="danger small" on:click={() => { const e = selectedEdge; if (e) { disconnect(e.from, e.to); selectedEdge = null; } }}>Delete connection</button>
              <button class="small" on:click={() => (selectedEdge = null)}>Cancel</button>
            </div>
          {/if}
          <div class="canvas-wrap scrollbar">
            <div class="canvas" style="width:{(maxX - minX) * LANE + PAD * 2}px; height:{(layout?.maxDepth ?? 0) * ROW + PAD * 2}px">
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <svg width={(maxX - minX) * LANE + PAD * 2} height={(layout?.maxDepth ?? 0) * ROW + PAD * 2}>
                {#each selected.nodes as n}
                  {#each n.prereqNodeIds as p}
                    {@const pp = layout?.pos.get(p)}
                    {@const np = layout?.pos.get(n.id)}
                    {#if pp && np}
                      {@const isSel = selectedEdge?.from === p && selectedEdge?.to === n.id}
                      <g class="edge-g" on:click|stopPropagation={() => { selectedEdge = isSel ? null : { from: p, to: n.id }; selectedNodeId = null; }}>
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
                  <button class="gn" class:sel={n.id === selectedNodeId} style="left:{px(p.x)}px; top:{py(p.depth)}px"
                    draggable="true"
                    on:click={() => (selectedNodeId = n.id)}
                    on:dragstart={() => (dragFrom = n.id)}
                    on:dragover|preventDefault
                    on:drop|preventDefault={() => { if (dragFrom) connect(dragFrom, n.id); dragFrom = null; }}>{n.name?.slice(0, 10) || n.id}</button>
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
                  <tr class:sel={n.id === selectedNodeId} on:click={() => (selectedNodeId = n.id)}>
                    <td>{n.name || n.id}</td>
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

        {#if selectedNode}
          <div class="nodeedit">
            <h4 style="margin:.2rem 0">Editing: {selectedNode.name || selectedNode.id}</h4>
            <NodeEditor node={selectedNode} {resources} canBranch={(kids.get(selectedNode.id) ?? []).length >= 2}
              on:change={(e) => updateNode(e.detail)} on:remove={() => removeNode(selectedNode.id)} />
          </div>
        {:else}
          <p class="faint">Select a node to edit it.</p>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .te { display: grid; grid-template-columns: 240px 1fr; gap: 1rem; align-items: start; }
  .list { position: sticky; top: 70px; display: flex; flex-direction: column; gap: 0.4rem; max-height: 88vh; }
  .search { width: 100%; }
  .treelist { display: flex; flex-direction: column; gap: 0.5rem; overflow: auto; }
  .catgroup { display: flex; flex-direction: column; gap: 0.2rem; }
  .catname { font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); }
  .titem { display: flex; justify-content: space-between; gap: 0.4rem; text-align: left; }
  .titem.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .tn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  .canvas-wrap { overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); max-height: 340px; }
  .canvas { position: relative; margin: 0 auto; }
  .gn { position: absolute; transform: translate(-50%, -50%); border-radius: 999px; padding: 0.25em 0.6em; font-size: 0.78em; white-space: nowrap; }
  .gn.sel { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .tablewrap { overflow: auto; max-height: 320px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid var(--border); padding: 0.25rem 0.4rem; text-align: left; font-size: 0.9em; }
  tbody tr { cursor: pointer; }
  tbody tr.sel { background: var(--bg-3); }
  .leads { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
  .leads .x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 0 0 0.2em; }
  .nodeedit { border-top: 1px solid var(--border); padding-top: 0.6rem; }
  .small { font-size: 0.85em; }
  @media (max-width: 820px) { .te { grid-template-columns: 1fr; } .list { position: static; } }
</style>
