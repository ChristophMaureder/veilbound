<script lang="ts">
  import type { Character, SkillTree } from '../types';
  import { treeStatus } from '../selectors';
  import { computeTreeView, maxReachableCount } from '../engine/tree';
  import { treeLocked, evalRequirements } from '../engine/requirements';
  import { openTree, updateTreeProgress, ruleset as rulesetStore, derivedActive, skillCardPanelOpen } from '../stores';

  export let tree: SkillTree;
  export let character: Character | null;
  export let showDesc = true;

  $: reqOpen = ($skillCardPanelOpen[tree.id]?.req ?? false);
  $: prereqOpen = ($skillCardPanelOpen[tree.id]?.prereq ?? false);

  function toggleReq() {
    skillCardPanelOpen.update((m) => {
      const cur = m[tree.id] ?? { req: false, prereq: false };
      return { ...m, [tree.id]: { ...cur, req: !cur.req } };
    });
  }
  function togglePrereq() {
    skillCardPanelOpen.update((m) => {
      const cur = m[tree.id] ?? { req: false, prereq: false };
      return { ...m, [tree.id]: { ...cur, prereq: !cur.prereq } };
    });
  }

  $: status = treeStatus(character, tree);
  $: locked = treeLocked(tree, character, $rulesetStore, $derivedActive);
  $: reqChecks = character && $derivedActive ? evalRequirements(tree, character, $rulesetStore, $derivedActive) : [];

  $: hasSoftPrereq = (() => {
    if (!character) return false;
    const p = character.trees[tree.id] ?? { prereqMet: {}, invested: {} };
    const view = computeTreeView(tree, p);
    return view.some((v) => v.available && !v.owned && v.node.prerequisite.trim() && !p.prereqMet[v.node.id]);
  })();

  $: softPrereqNodes = (() => {
    if (!character || !hasSoftPrereq) return [];
    const p = character.trees[tree.id] ?? { prereqMet: {}, invested: {} };
    const view = computeTreeView(tree, p);
    return view.filter((v) => v.available && !v.owned && v.node.prerequisite.trim() && !p.prereqMet[v.node.id]);
  })();

  function unlock() { updateTreeProgress(tree.id, (p) => ({ ...p, unlocked: true })); toggleReq(); }

  $: prog = (() => {
    const p = character?.trees[tree.id] ?? { prereqMet: {}, invested: {} };
    const v = computeTreeView(tree, p);
    const owned = v.filter((x) => x.owned).length;
    const total = maxReachableCount(tree, p);
    return { owned, total };
  })();

  const LABEL = { owned: 'Owned', available: 'Available' } as const;

  $: statusLabel = locked ? '🔒 Locked' : hasSoftPrereq ? 'Prereq.' : LABEL[status];
  $: statusClass = locked ? 'locked' : hasSoftPrereq ? 'prereq' : status;
</script>

<div
  class="card"
  class:owned={status === 'owned'}
  class:locked
  class:has-prereq={hasSoftPrereq && !locked}
  style="--rarity-c: {tree.rarity === 'legendary' ? '#c8a44a' : tree.rarity === 'expert' ? '#7ec8a8' : 'var(--border)'}"
  on:click={() => openTree(tree.id)}
>
  <div class="top">
    <div class="nm-wrap">
      <strong class="nm">{tree.name}</strong>
      {#if tree.treeType === 'spell'}<span class="spell-pill">✦ Spell</span>{/if}
    </div>
    <span
      class="status {statusClass}"
      class:clickable={locked || hasSoftPrereq}
      on:click|stopPropagation={() => { if (locked) toggleReq(); else if (hasSoftPrereq) togglePrereq(); }}
    >{statusLabel}</span>
  </div>
  {#if showDesc && tree.description}<p class="desc">{tree.description}</p>{/if}
  <div class="tags">{#each tree.tags as t}<span class="pill">{t}</span>{/each}</div>
  {#if locked && reqOpen}
    <div class="reqs" on:click|stopPropagation>
      {#each reqChecks as c}<div class="req" class:met={c.met}>{c.met ? '✓' : '•'} {c.label} <span class="faint">{c.progress}</span></div>{/each}
      <button class="small unlock" on:click|stopPropagation={unlock}>🔓 Unlock</button>
    </div>
  {/if}
  {#if hasSoftPrereq && !locked && prereqOpen}
    <div class="reqs" on:click|stopPropagation>
      {#each softPrereqNodes as v}
        <div class="req prereq-item">
          <strong>{v.node.name}</strong> — {v.node.prerequisite}
        </div>
      {/each}
    </div>
  {/if}
  {#if status === 'owned'}<div class="prog faint">{prog.owned}/{prog.total} nodes owned</div>{/if}
</div>

<style>
  .card {
    background: var(--bg-2);
    border: 1px solid var(--rarity-c, var(--border));
    border-radius: var(--radius);
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
  }
  .card:hover { border-color: var(--accent-2); background: color-mix(in srgb, var(--bg-2) 92%, var(--accent)); }
  .card.owned { border-color: color-mix(in srgb, var(--good) 40%, var(--rarity-c, var(--border))); }
  .card.locked { border-color: color-mix(in srgb, var(--warn) 35%, var(--rarity-c, var(--border))); }
  .card.has-prereq { border-color: color-mix(in srgb, var(--accent) 40%, var(--rarity-c, var(--border))); }
  .nm-wrap { display: flex; align-items: baseline; gap: 0.4rem; flex: 1; min-width: 0; }
  .spell-pill { font-size: 0.7em; color: #8ab0f0; background: rgba(100,160,240,0.13); border: 1px solid rgba(100,160,240,0.3); border-radius: 999px; padding: 0.1em 0.45em; white-space: nowrap; flex-shrink: 0; }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }
  .nm { font-size: 1.05em; }
  .status {
    font-size: 0.72em;
    padding: 0.1em 0.5em;
    border-radius: 999px;
    background: var(--bg-3);
    color: var(--text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .status.clickable { cursor: pointer; }
  .status.clickable:hover { filter: brightness(1.2); }
  .status.owned { background: rgba(94, 201, 138, 0.2); color: var(--good); }
  .status.available { background: rgba(124, 95, 212, 0.22); color: var(--accent); }
  .status.locked { background: rgba(224, 179, 74, 0.18); color: var(--warn); }
  .status.prereq { background: rgba(100, 160, 220, 0.2); color: #7ab0e0; }
  .reqs {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.82em;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.5rem;
  }
  .req { color: var(--text-dim); }
  .req.met { color: var(--good); }
  .unlock { align-self: flex-start; margin-top: 0.2rem; }
  .prereq-item { color: #7ab0e0; }
  .desc {
    margin: 0;
    font-size: 0.9em;
    color: var(--text-dim);
  }
  .tags { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .prog { font-size: 0.82em; }
</style>
