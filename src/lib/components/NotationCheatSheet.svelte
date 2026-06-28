<script lang="ts">
  import { ruleset } from '../stores';

  /** Show the weapon-reference section (only meaningful for weapon-linked actions/modifiers). */
  export let weapon = false;
  export let open = false;

  $: resources = $ruleset.resources;
  $: damageTypes = $ruleset.damageTypes;
</script>

<div class="cheat">
  <button class="head" type="button" on:click={() => (open = !open)}>
    <span class="tw">{open ? '▾' : '▸'}</span> Notation cheat sheet
  </button>
  {#if open}
    <div class="body">
      <p class="note">Wrap any of the below in <code>{'{{'} … {'}}'}</code> to embed it in flavour/effect text. Damage and to-hit fields are already evaluated — no braces needed there.</p>

      <div class="grp">
        <h5>Values</h5>
        <p><code>STR</code> <code>DEX</code> <code>KNO</code> <code>WIL</code> <code>prof</code> <code>level</code> <code>crit</code> <code>soul</code> <code>damage</code></p>
        {#if resources.length}
          <p class="ctx">Resources (current value): {#each resources as r, i}<code>{r.id}</code>{#if i < resources.length - 1}{' '}{/if}{/each}</p>
        {/if}
      </div>

      <div class="grp">
        <h5>Maths</h5>
        <p>Operators <code>+ − * / % ^</code> &nbsp; Functions <code>min</code> <code>max</code> <code>floor</code> <code>ceil</code> <code>round</code> <code>abs</code> <code>clamp(x,lo,hi)</code></p>
        <p class="eg">e.g. <code>floor(STR / 2) + prof</code></p>
      </div>

      <div class="grp">
        <h5>Dice &amp; damage</h5>
        <p>Dice <code>2d6</code>, mix with flats <code>2d6 + 3</code>.</p>
        <p>Append a damage type to colour a term: {#each damageTypes.slice(0, 4) as d}<code>2d6 {d.name}</code> {/each}</p>
        <p class="ctx">A term with no type inherits the type to its left.</p>
      </div>

      {#if weapon}
        <div class="grp">
          <h5>Weapon references <span class="tag">weapon-linked only</span></h5>
          <p><code>main</code> = main-hand weapon damage, <code>side</code> = off-hand.</p>
          <p>Scale it: <code>2 * main</code> (doubles dice &amp; flats) &nbsp; Combine: <code>main + side</code></p>
          <p class="eg">e.g. an action that hits four times as hard: <code>4 * main</code> (1d8+2 → 4d8+8)</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cheat { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); }
  .head { width: 100%; text-align: left; background: var(--bg-2); border: none; padding: 0.35rem 0.55rem; font-size: 0.82em; color: var(--text-dim); cursor: pointer; }
  .head:hover { background: var(--bg-3); color: var(--text); }
  .tw { color: var(--text-faint); }
  .body { padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84em; }
  .note { margin: 0; color: var(--text-dim); }
  .grp { display: flex; flex-direction: column; gap: 0.15rem; }
  .grp h5 { margin: 0; font-size: 0.92em; }
  .grp p { margin: 0; line-height: 1.6; }
  .ctx, .eg { color: var(--text-dim); font-style: italic; }
  code { background: var(--bg-3); border: 1px solid var(--border); border-radius: 4px; padding: 0.05em 0.35em; font-size: 0.92em; }
  .tag { font-size: 0.7em; font-style: normal; color: var(--accent-2); border: 1px solid var(--accent-2); border-radius: 999px; padding: 0 0.4em; vertical-align: middle; }
</style>
