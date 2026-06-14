<script lang="ts">
  import { onMount } from 'svelte';
  import { dragGhost, ghostDragEnd } from '../dragGhost';

  onMount(() => {
    // pointerup doesn't fire during HTML5 DnD (browser suppresses it).
    // Capture-phase dragend on document fires even if the source element is
    // destroyed by a Svelte re-render before dragend reaches it.
    document.addEventListener('dragend', ghostDragEnd, true);
    return () => document.removeEventListener('dragend', ghostDragEnd, true);
  });
</script>

{#if $dragGhost}
  <div class="ghost" style="left:{$dragGhost.x}px;top:{$dragGhost.y}px">
    <span class="dots">⠿</span>
    <span class="lbl">{$dragGhost.label}</span>
  </div>
{/if}

<style>
  .ghost {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    background: var(--bg-2);
    border: 2px solid var(--accent);
    border-radius: 6px;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.9em;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
    transform: translate(12px, -50%);
    cursor: grabbing;
  }
  .dots { color: var(--text-faint); font-size: 1.1em; }
</style>
