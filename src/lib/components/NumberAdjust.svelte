<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Type-only number field paired with Add / Subtract. Pressing either applies
      the typed value and clears the field immediately (§0). Uses a text input so
      the bound value stays a string (a bound number input breaks .trim()). */
  export let subFirst = true; // default layout [Subtract][field][Add] (rev4 §0)
  export let placeholder = '0';
  export let allowNegative = true;

  const dispatch = createEventDispatcher<{ add: number; subtract: number }>();
  let val = '';

  function fire(kind: 'add' | 'subtract') {
    const n = Number(val);
    if (val.trim() === '' || !Number.isFinite(n)) return;
    dispatch(kind, allowNegative ? n : Math.abs(n));
    val = '';
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') fire('add');
  }
  function onInput(e: Event) {
    // keep only number-ish characters
    val = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, '');
  }
</script>

<div class="na">
  {#if subFirst}<button class="small" on:click={() => fire('subtract')}>Subtract</button>{/if}
  <input type="text" inputmode="numeric" value={val} {placeholder} on:input={onInput} on:keydown={onKey} aria-label="amount" />
  <button class="small primary" on:click={() => fire('add')}>Add</button>
  {#if !subFirst}<button class="small" on:click={() => fire('subtract')}>Subtract</button>{/if}
</div>

<style>
  .na { display: flex; gap: 0.3rem; align-items: center; }
  .na input { width: 72px; text-align: center; }
</style>
