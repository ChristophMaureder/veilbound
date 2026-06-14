<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { dur } from '../motion';

  export let title = '';
  export let wide = false;
  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKey} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="overlay" on:click|self={close} transition:fade={{ duration: dur(120) }}>
  <div
    class="modal scrollbar"
    class:wide
    role="dialog"
    aria-modal="true"
    transition:scale={{ duration: dur(140), start: 0.96 }}
  >
    <header>
      <h3>{title}</h3>
      <button class="ghost" on:click={close} aria-label="Close">✕</button>
    </header>
    <div class="body scrollbar">
      <slot />
    </div>
    {#if $$slots.footer}
      <footer>
        <slot name="footer" />
      </footer>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(8, 7, 12, 0.66);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 4vh 1rem;
    z-index: 100;
    overflow: auto;
  }
  .modal {
    background: var(--panel);
    border: 1px solid var(--border-2);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    width: min(560px, 100%);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
  }
  .modal.wide {
    width: min(960px, 100%);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 1.1rem;
    border-bottom: 1px solid var(--border);
  }
  header h3 {
    margin: 0;
  }
  .body {
    padding: 1.1rem;
    overflow: auto;
  }
  footer {
    padding: 0.8rem 1.1rem;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
