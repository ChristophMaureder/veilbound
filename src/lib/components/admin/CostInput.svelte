<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Action-cost editor (§4): toggle Action / Reaction; Action also takes a
      number. Emits the canonical string ("1 Action" / "2 Actions" / "Reaction"). */
  export let value: string;

  const dispatch = createEventDispatcher<{ change: string }>();
  $: isReaction = /^reaction/i.test(value.trim());
  $: count = (() => {
    const m = /(\d+)/.exec(value);
    return m ? Number(m[1]) : 1;
  })();

  function emit(reaction: boolean, n: number) {
    dispatch('change', reaction ? 'Reaction' : `${n} Action${n === 1 ? '' : 's'}`);
  }
</script>

<div class="cost">
  <select value={isReaction ? 'reaction' : 'action'} on:change={(e) => emit(e.currentTarget.value === 'reaction', count)}>
    <option value="action">Action</option>
    <option value="reaction">Reaction</option>
  </select>
  {#if !isReaction}
    <input type="number" min="1" value={count} on:input={(e) => emit(false, Math.max(1, Math.round(Number(e.currentTarget.value) || 1)))} />
  {/if}
</div>

<style>
  .cost { display: flex; gap: 0.3rem; align-items: center; }
  .cost input { width: 60px; }
</style>
