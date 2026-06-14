<script lang="ts">
  import type { DerivedValue } from '../engine/derive';
  export let label: string;
  export let dv: DerivedValue;
</script>

<div class="bd">
  <strong>{label}</strong>
  <div class="line">
    <span class="muted">Base (calculated)</span>
    <span class="mono">{dv.base}</span>
  </div>
  {#each dv.contributions as c (c.id)}
    <div class="line">
      <span class="muted">{c.name} <span class="src">{c.source}</span></span>
      <span class="mono" class:pos={c.value >= 0} class:neg={c.value < 0}>
        {c.value >= 0 ? '+' : ''}{c.value}
      </span>
    </div>
  {/each}
  {#if dv.contributions.length === 0}
    <div class="line faint">No modifiers</div>
  {/if}
  <div class="line total">
    <span>Effective</span>
    <span class="mono">{dv.effective}</span>
  </div>
</div>

<style>
  .bd {
    min-width: 190px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 1.2rem;
    padding: 1px 0;
  }
  .src {
    font-size: 0.7em;
    opacity: 0.6;
    text-transform: uppercase;
    margin-left: 0.2em;
  }
  .total {
    border-top: 1px solid var(--border);
    margin-top: 4px;
    padding-top: 4px;
    font-weight: 600;
  }
  .pos {
    color: var(--good);
  }
  .neg {
    color: var(--bad);
  }
</style>
