<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { dur } from '../motion';

  /** A number that animates ("ticks") to its new value (§10). */
  export let value: number;

  const t = tweened(value, { duration: dur(400), easing: cubicOut });
  $: t.set(value);
</script>

<span class="tick">{Math.round($t)}</span>

<style>
  .tick {
    font-variant-numeric: tabular-nums;
  }
</style>
