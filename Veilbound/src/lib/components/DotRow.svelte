<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { scale } from 'svelte/transition';
  import { dur } from '../motion';

  /** A clickable row of dots (soul, rechargeable resources). Dots scale/fade in
      and out, staggered one by one, when `max` changes (§10). */
  export let value: number;
  export let max: number;
  export let colour = 'var(--accent)';
  export let readonly = false;
  export let size = 18;

  const dispatch = createEventDispatcher<{ change: number }>();

  $: dots = Array.from({ length: Math.max(0, max) }, (_, i) => i);

  function click(i: number) {
    if (readonly) return;
    const pos = i + 1;
    // Clicking the highest filled dot empties it; otherwise fill up to here.
    const next = value === pos ? pos - 1 : pos;
    dispatch('change', next);
  }
</script>

<div class="dots" style="--c:{colour}; --sz:{size}px;">
  {#each dots as i (i)}
    <button
      type="button"
      class="dot"
      class:filled={i < value}
      class:readonly
      on:click={() => click(i)}
      aria-label={`Set to ${i + 1}`}
      transition:scale|local={{ duration: dur(220), start: 0.2, delay: dur(i * 35) }}
    ></button>
  {/each}
  {#if max === 0}
    <span class="faint">—</span>
  {/if}
</div>

<style>
  .dots {
    display: inline-flex;
    gap: 5px;
    flex-wrap: wrap;
    align-items: center;
  }
  .dot {
    width: var(--sz);
    height: var(--sz);
    border-radius: 50%;
    padding: 0;
    border: 2px solid var(--c);
    background: transparent;
    transition: background 0.14s ease, box-shadow 0.14s ease, transform 0.06s ease;
  }
  .dot.filled {
    background: var(--c);
    box-shadow: 0 0 6px -1px var(--c);
  }
  .dot.readonly {
    cursor: default;
  }
  .dot:not(.readonly):hover {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent);
  }
</style>
