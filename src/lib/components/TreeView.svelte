<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import {
    activeCharacter, ruleset as rulesetStore, derivedActive, gmMode, forceReveal,
    openTreeId, updateTreeProgress,
  } from '../stores';
  import { computeTreeView, computeLayout, computeDisplayNames, pourPoints, unlearnFrom, learnPathTo, type NodeView } from '../engine/tree';
  import { treeLocked, evalRequirements } from '../engine/requirements';
  import type { TreeProgress } from '../types';
  import { dur } from '../motion';
  import NodeTooltip from './NodeTooltip.svelte';

  export let treeId: string;

  $: tree = $rulesetStore.trees.find((t) => t.id === treeId) ?? null;
  $: character = $activeCharacter;
  $: progress = (character?.trees[treeId] ?? { prereqMet: {}, invested: {} }) as TreeProgress;
  $: revealed = $gmMode || $forceReveal;
  $: remaining = $derivedActive?.skillRemaining ?? 0;
  $: ctx = $derivedActive?.ctx ?? {};
  $: view = tree ? computeTreeView(tree, progress) : [];
  $: layout = tree ? computeLayout(tree) : null;
  $: displayNames = computeDisplayNames(tree?.nodes ?? []);
  const dn = (v: NodeView) => displayNames.get(v.node.id) ?? v.node.name;

  // Structured requirement gate (§ requirements). Locked = unmet & not overridden.
  $: reqChecks = tree && character && $derivedActive ? evalRequirements(tree, character, $rulesetStore, $derivedActive) : [];
  $: locked = tree ? treeLocked(tree, character, $rulesetStore, $derivedActive) : false;
  function unlockTree() { if (tree) updateTreeProgress(tree.id, (p) => ({ ...p, unlocked: true })); }
  function relockTree() { if (tree) updateTreeProgress(tree.id, (p) => ({ ...p, unlocked: false })); }

  let mode: 'node' | 'list' = 'node';

  const isMilestone = (depth: number) => depth === 0 || (depth + 1) % 5 === 0;

  // Layout (bottom-up: depth 0 at the bottom, §7).
  const ROW = 84, LANE = 150, PAD = 50, TOP = 40;
  $: minX = layout ? Math.min(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  $: maxX = layout ? Math.max(0, ...[...layout.pos.values()].map((p) => p.x)) : 0;
  $: maxDepth = layout?.maxDepth ?? 0;
  $: canvasW = (maxX - minX) * LANE + PAD * 2;
  $: canvasH = maxDepth * ROW + TOP + PAD;
  const cx = (x: number) => (x - minX) * LANE + PAD;
  const cy = (depth: number) => (maxDepth - depth) * ROW + TOP;

  $: byId = new Map(view.map((v) => [v.node.id, v]));
  $: edges = view.flatMap((v) =>
    v.node.prereqNodeIds.map((p) => byId.get(p)).filter((p): p is NodeView => !!p).map((p) => ({ from: p, to: v })),
  );

  let selected: NodeView | null = null;
  let hoveredNode: NodeView | null = null;
  let selectedRect = { left: 0, top: 0, right: 0 };
  let hoverNodeRect = { left: 0, top: 0, right: 0 };
  let infoPanelPos = { x: 0, y: 0 };
  let investPanelPos = { x: 0, y: 0 };
  let confirmUnlearn: string | null = null;
  let askPrereqFor: NodeView | null = null;
  let custom = 1;

  $: if (selected) selected = view.find((v) => v.node.id === selected!.node.id) ?? null;
  $: infoNode = selected ?? hoveredNode;

  const hiddenName = (v: NodeView) => v.node.hideName && !revealed;

  function posInfo(r: { left: number; top: number; right: number }): { x: number; y: number } {
    const W = 300, GAP = 12;
    let x = r.left - W - GAP;
    if (x < 8) x = r.right + GAP;
    let y = r.top - 20;
    if (y + 420 > window.innerHeight) y = window.innerHeight - 420 - 8;
    if (y < 8) y = 8;
    return { x, y };
  }
  function posInvest(r: { left: number; top: number; right: number }): { x: number; y: number } {
    const W = 240, GAP = 12;
    let x = r.right + GAP;
    if (x + W > window.innerWidth) x = r.left - W - GAP;
    if (x < 8) x = 8;
    let y = r.top - 10;
    if (y + 360 > window.innerHeight) y = window.innerHeight - 360 - 8;
    if (y < 8) y = 8;
    return { x, y };
  }

  function startHover(v: NodeView, e: MouseEvent) {
    hoveredNode = v;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverNodeRect = { left: r.left, top: r.top, right: r.right };
    if (!selected) infoPanelPos = posInfo(hoverNodeRect);
  }
  function endHover() { hoveredNode = null; }

  function openNode(v: NodeView, e: MouseEvent) {
    if (v.locked) return; // exclusive branch — unchosen path, not investable
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (selected?.node.id === v.node.id) {
      selected = null;
    } else {
      selectedRect = { left: r.left, top: r.top, right: r.right };
      selected = v;
      infoPanelPos = posInfo(selectedRect);
      investPanelPos = posInvest(selectedRect);
    }
    confirmUnlearn = null;
  }

  function tryInvest(v: NodeView, amount: number) {
    if (!tree || locked) return;
    if (v.node.prerequisite.trim() && progress.prereqMet[v.node.id] === undefined) {
      askPrereqFor = v;
      return;
    }
    const res = pourPoints(tree, progress, v.node.id, amount, remaining);
    updateTreeProgress(tree.id, (p) => ({ ...p, invested: res.invested }));
  }
  function tryLearnPath(v: NodeView) {
    if (!tree || locked) return;
    if (v.node.prerequisite.trim() && progress.prereqMet[v.node.id] === undefined) {
      askPrereqFor = v;
      return;
    }
    const res = learnPathTo(tree, progress, v.node.id, remaining);
    updateTreeProgress(tree.id, (p) => ({ ...p, invested: res.invested }));
  }
  function answerPrereq(yes: boolean) {
    if (!tree || !askPrereqFor) return;
    const id = askPrereqFor.node.id;
    updateTreeProgress(tree.id, (p) => ({ ...p, prereqMet: { ...p.prereqMet, [id]: yes } }));
    askPrereqFor = null;
  }
  function unlearn(v: NodeView) {
    if (!tree) return;
    const res = unlearnFrom(tree, progress, v.node.id);
    updateTreeProgress(tree.id, (p) => ({ ...p, invested: res.invested }));
    selected = null;
  }
  function close() { openTreeId.set(null); }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (askPrereqFor) askPrereqFor = null;
      else if (selected) selected = null;
      else close();
    }
  }
  $: justEnough = selected ? Math.max(0, selected.cost - selected.invested) : 0;
  $: listView = [...view].sort((a, b) => (layout?.pos.get(a.node.id)?.depth ?? 0) - (layout?.pos.get(b.node.id)?.depth ?? 0));
</script>

<svelte:window on:keydown={onKey} />

{#if tree}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={close} transition:fade={{ duration: dur(120) }}>
    <div class="tv" transition:scale={{ duration: dur(150), start: 0.97 }}>
      <header>
        <div class="col" style="gap:2px"><h3 style="margin:0">{tree.name}</h3><div class="faint" style="font-size:.84em">{tree.category} · {tree.tags.join(', ')}</div></div>
        <span class="spacer"></span>
        <div class="modeswitch"><button class:active={mode === 'node'} on:click={() => (mode = 'node')}>Node</button><button class:active={mode === 'list'} on:click={() => { mode = 'list'; selected = null; }}>List</button></div>
        <button class="ghost" on:click={close} aria-label="Close">✕</button>
      </header>
      {#if tree.description}<p class="desc">{tree.description}</p>{/if}

      {#if reqChecks.length}
        <div class="reqbar" class:locked>
          <span class="reqlead">{locked ? '🔒 Requirements' : '✓ Requirements'}</span>
          {#each reqChecks as c}
            <span class="reqpill" class:met={c.met}>{c.met ? '✓' : '•'} {c.label} <span class="faint">{c.progress}</span></span>
          {/each}
          <span class="spacer"></span>
          {#if locked}
            <button class="small primary" on:click={unlockTree} title="Override the gate and allow investing anyway">Unlock anyway</button>
          {:else if character?.trees[tree.id]?.unlocked}
            <button class="small ghost" on:click={relockTree} title="Re-apply the requirement gate">Re-lock</button>
          {/if}
        </div>
      {/if}

      {#if mode === 'node'}
        <div class="canvas-wrap scrollbar">
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div class="canvas" style="width:{canvasW}px; height:{canvasH}px" on:click={() => { selected = null; confirmUnlearn = null; }}>
            <svg width={canvasW} height={canvasH} class="edges">
              {#each edges as e}<line x1={cx(layout?.pos.get(e.from.node.id)?.x ?? 0)} y1={cy(layout?.pos.get(e.from.node.id)?.depth ?? 0)} x2={cx(layout?.pos.get(e.to.node.id)?.x ?? 0)} y2={cy(layout?.pos.get(e.to.node.id)?.depth ?? 0)} class:owned={e.from.owned && e.to.owned} />{/each}
            </svg>
            {#each view as v (v.node.id)}
              {@const p = layout?.pos.get(v.node.id)}
              {#if p}
                <div class="node-wrap" class:milestone={isMilestone(p.depth)} style="left:{cx(p.x)}px; top:{cy(p.depth)}px; --sz:{isMilestone(p.depth) ? 46 : 34}px">
                  <button class="node" class:owned={v.owned} class:available={v.available && !v.owned} class:partial={v.partial} class:locked={v.locked} class:sel={selected?.node.id === v.node.id} class:milestone={isMilestone(p.depth)} style="--fill:{v.fill * 360}deg"
                    on:click|stopPropagation={(e) => openNode(v, e)}
                    on:mouseenter={(e) => startHover(v, e)}
                    on:mouseleave={endHover}>
                    <span class="ring"></span><span class="face"></span>
                  </button>
                  <span class="nlabel" class:dim={!v.available && !v.owned}>{hiddenName(v) ? '???' : dn(v) || '·'}</span>
                  {#if v.partial}<span class="miss">needs {v.missing}</span>{/if}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div class="list scrollbar">
          {#each listView as v (v.node.id)}
            <div class="lrow" class:owned={v.owned}>
              <div class="ldot" class:owned={v.owned} class:available={v.available && !v.owned} class:milestone={isMilestone(layout?.pos.get(v.node.id)?.depth ?? -1)} style="--fill:{v.fill * 360}deg"></div>
              <div class="linfo"><NodeTooltip view={v} {revealed} {ctx} overrideName={dn(v)} /></div>
              <div class="lctrl">
                {#if v.available && !v.owned}<button class="small primary" on:click={(e) => openNode(v, e)} disabled={remaining === 0 && v.invested === 0}>Learn</button>{/if}
                {#if v.invested > 0}<button class="small danger" on:click={() => unlearn(v)} title="Unlearn (cascades up)">⟲</button>{/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <footer>
        <span class="legend"><span class="sw owned"></span> owned</span>
        <span class="legend"><span class="sw available"></span> available</span>
        <span class="legend"><span class="sw partial"></span> in progress</span>
        <span class="spacer"></span><span class="muted">Remaining points: <strong>{remaining}</strong></span>
      </footer>
    </div>
  </div>

  <!-- Info panel — left of node, shows on hover; stays pinned when selected -->
  {#if infoNode && mode === 'node'}
    <div class="infopop" style="left:{infoPanelPos.x}px; top:{infoPanelPos.y}px" transition:fade={{ duration: dur(80) }}>
      <NodeTooltip view={infoNode} {revealed} {ctx} overrideName={dn(infoNode)} />
      {#if selected?.node.id === infoNode.node.id && infoNode.owned}
        <div class="ownedctrl">
          {#if confirmUnlearn === infoNode.node.id}
            <span class="faint small">Unlearn cascades up. Sure?</span>
            <button class="danger small" on:click|stopPropagation={() => unlearn(infoNode)}>Yes</button>
            <button class="small" on:click|stopPropagation={() => (confirmUnlearn = null)}>Cancel</button>
          {:else}
            <button class="small unlearn" on:click|stopPropagation={() => (confirmUnlearn = infoNode.node.id)}>⟲ Unlearn</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Invest panel — right of node, only when selected and not yet owned -->
  {#if selected && !selected.owned}
    {@const sel = selected}
    <div class="investpop" style="left:{investPanelPos.x}px; top:{investPanelPos.y}px" transition:fade={{ duration: dur(90) }}>
      <div class="poptitle">{hiddenName(sel) ? '???' : dn(sel) || 'Node'} <span class="faint">{sel.invested}/{sel.cost}</span></div>
      {#if locked}
        <p class=”invnote”>🔒 Tree is locked — meet its requirements or unlock manually.</p>
        <button class=”small” class:primary={true} style=”margin-top:.4rem” on:click={unlockTree}>Unlock anyway</button>
      {:else if sel.available}
        <p class=”invnote”>{remaining} pts remaining</p>
        <div class=”opts”>
          <button class=”small” class:primary={true} disabled={justEnough === 0} on:click={() => tryInvest(sel, justEnough)}>Learn this ({Math.min(justEnough, remaining)})</button>
          <button class=”small” disabled={remaining === 0} on:click={() => tryInvest(sel, remaining)}>All in ({remaining})</button>
        </div>
      {:else if !sel.available}
        <p class=”invnote”>{remaining} pts remaining</p>
        <div class=”opts”>
          <button class=”small” class:primary={true} disabled={remaining === 0} on:click={() => tryLearnPath(sel)}>Learn path to here</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if askPrereqFor}
    <div class="overlay prq" transition:fade={{ duration: dur(100) }}>
      <div class="prqbox panel">
        <h4 style="margin-top:0">Prerequisite check</h4>
        <p>Before learning <strong>{askPrereqFor.node.name || 'this node'}</strong>, confirm once:</p>
        <blockquote>{askPrereqFor.node.prerequisite}</blockquote>
        <p class="faint">Self-attested — nothing is enforced.</p>
        <div class="row" style="justify-content:flex-end"><button on:click={() => answerPrereq(false)}>No</button><button class="primary" on:click={() => answerPrereq(true)}>Yes, I meet it</button></div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .overlay { position: fixed; inset: 0; background: rgba(8,7,12,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 3vh 1rem; z-index: 120; overflow: auto; }
  .tv { background: var(--panel); border: 1px solid var(--border-2); border-radius: var(--radius); box-shadow: var(--shadow); width: min(860px, 100%); max-height: 94vh; display: flex; flex-direction: column; padding: 1rem 1.1rem; }
  header { display: flex; align-items: center; gap: 0.6rem; }
  .modeswitch button { border-radius: 0; }
  .modeswitch button:first-child { border-radius: 6px 0 0 6px; }
  .modeswitch button:last-child { border-radius: 0 6px 6px 0; }
  .modeswitch button.active { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .desc { margin: 0.5rem 0; color: var(--text-dim); }
  .reqbar { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; padding: 0.4rem 0.55rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-2); margin-bottom: 0.5rem; font-size: 0.85em; }
  .reqbar.locked { border-color: #6b5a2d; background: rgba(224,179,74,0.08); }
  .reqlead { font-weight: 700; }
  .reqpill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.1em 0.5em; border-radius: 999px; background: var(--bg-3); border: 1px solid var(--border-2); color: var(--text-dim); }
  .reqpill.met { color: var(--good); border-color: #2d6b45; }
  .canvas-wrap { overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: radial-gradient(600px 300px at 50% 100%, #201d2c, var(--bg)); flex: 1; min-height: 280px; }
  .canvas { position: relative; margin: 0 auto; }
  .edges line { stroke: var(--border-2); stroke-width: 3; }
  .edges line.owned { stroke: var(--good); }
  .node-wrap { position: absolute; width: var(--sz, 34px); height: var(--sz, 34px); transform: translate(-50%, -50%); transition: width 0.15s, height 0.15s; }
  .node-wrap:hover { z-index: 50; }
  .node { position: relative; width: var(--sz, 34px); height: var(--sz, 34px); border-radius: 50%; border: none; padding: 0; background: transparent; flex: 0 0 auto; }
  .node.milestone { border-radius: 0; transform: rotate(45deg); }
  .ring { position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(var(--accent) var(--fill, 0deg), var(--border) 0deg); }
  .node.milestone .ring { border-radius: 0; }
  .face { position: absolute; inset: 0; margin: 3px; border-radius: 50%; background: var(--bg-3); border: 1px solid var(--border); }
  .node.milestone .face { border-radius: 0; }
  .node.available .face { background: var(--bg-2); border-color: var(--accent-2); cursor: pointer; }
  .node.available:hover .face, .node.sel .face { box-shadow: 0 0 0 4px rgba(124,95,212,0.4); }
  .node.owned .face { background: linear-gradient(180deg, #2f5a42, #244a36); border-color: var(--good); }
  .node.locked { cursor: default; }
  .node.locked .face { background: #1a1620; border-color: #3a2530; }
  .node.sel .ring { background: conic-gradient(var(--accent) var(--fill, 0deg), var(--accent-2) 0deg); }
  .nlabel { position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); font-size: 0.78em; white-space: nowrap; color: var(--text); pointer-events: none; }
  .nlabel.dim { color: var(--text-faint); }
  .node-wrap.milestone .nlabel { left: calc(100% + 16px); font-size: 0.86em; }
  .miss { position: absolute; top: calc(100% + 2px); left: 50%; transform: translateX(-50%); font-size: 0.66em; color: var(--warn); white-space: nowrap; }
  .list { overflow: auto; display: flex; flex-direction: column; gap: 0.4rem; max-height: 62vh; }
  .lrow { display: flex; gap: 0.6rem; align-items: flex-start; background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.6rem; }
  .lrow.owned { border-color: color-mix(in srgb, var(--good) 40%, var(--border)); }
  .ldot { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; margin-top: 2px; background: conic-gradient(var(--accent) var(--fill, 0deg), var(--border) 0deg); border: 2px solid var(--border-2); }
  .ldot.owned { background: var(--good); border-color: var(--good); }
  .ldot.available { border-color: var(--accent-2); }
  .ldot.milestone { width: 24px; height: 24px; border-width: 2.5px; }
  .linfo { flex: 1; min-width: 0; }
  .lctrl { display: flex; gap: 0.3rem; }
  footer { display: flex; align-items: center; gap: 0.9rem; margin-top: 0.7rem; font-size: 0.82em; flex-wrap: wrap; }
  .legend { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--text-dim); }
  .sw { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 2px solid var(--border-2); }
  .sw.owned { background: var(--good); border-color: var(--good); }
  .sw.available { border-color: var(--accent-2); }
  .sw.partial { background: conic-gradient(var(--accent) 180deg, var(--border) 0); }
  /* Info panel — left side, read-only */
  .infopop { position: fixed; z-index: 300; width: 300px; background: #0f0e15; border: 1px solid var(--border-2); border-radius: var(--radius-sm); box-shadow: var(--shadow); padding: 0.7rem; pointer-events: none; }
  .infopop .ownedctrl { pointer-events: all; }
  /* Invest panel — right side, interactive */
  .investpop { position: fixed; z-index: 300; width: 230px; background: #0f0e15; border: 1px solid var(--border-2); border-radius: var(--radius-sm); box-shadow: var(--shadow); padding: 0.6rem; }
  .ownedctrl { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .poptitle { font-weight: 600; margin-bottom: 0.3rem; }
  .invnote { margin: 0 0 0.3rem; font-size: 0.85em; color: var(--text-dim); }
  .inv-btn { font-size: 0.85em; padding: 0.3em 0.7em; border-radius: var(--radius-sm); cursor: pointer; }
  .inv-pri { background: var(--accent-2); border-color: var(--accent); color: #fff; }
  .inv-pri:disabled { opacity: 0.4; cursor: not-allowed; }
  .inv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ownedctrl { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem; }
  .small { font-size: 0.85em; }
  .opts { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.3rem; }
  .opts input { width: 60px; }
  .unlearn { margin-top: 0.5rem; width: 100%; }
  .prq { z-index: 340; align-items: center; }
  .prqbox { width: min(440px, 100%); }
  blockquote { border-left: 3px solid var(--accent-2); margin: 0.5rem 0; padding: 0.3rem 0.8rem; color: var(--text-dim); }
</style>
