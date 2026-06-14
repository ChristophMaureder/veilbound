<script lang="ts">
  import { fade } from 'svelte/transition';
  import { dur } from '../motion';

  /** Hover/focus tooltip. Put trigger content in the default slot and the
      tooltip content in the "tip" slot. */
  export let placement: 'top' | 'bottom' = 'top';
  let show = false;
</script>

<span
  class="trigger"
  on:mouseenter={() => (show = true)}
  on:mouseleave={() => (show = false)}
  on:focusin={() => (show = true)}
  on:focusout={() => (show = false)}
>
  <slot />
  {#if show}
    <span class="tip {placement}" role="tooltip" transition:fade={{ duration: dur(90) }}>
      <slot name="tip" />
    </span>
  {/if}
</span>

<style>
  .trigger {
    position: relative;
    display: inline-flex;
  }
  .tip {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    background: #0f0e15;
    border: 1px solid var(--border-2);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow);
    padding: 0.6rem 0.7rem;
    width: max-content;
    max-width: 280px;
    font-size: 0.85em;
    color: var(--text);
    pointer-events: none;
    white-space: normal;
  }
  .tip.top {
    bottom: calc(100% + 8px);
  }
  .tip.bottom {
    top: calc(100% + 8px);
  }
</style>
