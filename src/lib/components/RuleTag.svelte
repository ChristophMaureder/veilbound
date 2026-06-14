<script lang="ts">
  import { ruleset } from '../stores';
  import Tooltip from './Tooltip.svelte';

  /** A rule tag chip; hovering shows its GM-defined explanation (§5.1). */
  export let tag: string;
  $: def = $ruleset.ruleTags.find((d) => d.tag.toLowerCase() === tag.toLowerCase());
</script>

<Tooltip placement="top">
  <span class="pill rt">{tag}</span>
  <svelte:fragment slot="tip">
    <div class="def">
      <strong>{tag}</strong>
      <p>{def ? def.description : 'No definition yet.'}</p>
    </div>
  </svelte:fragment>
</Tooltip>

<style>
  .rt {
    cursor: help;
    border-style: dashed;
  }
  .def {
    max-width: 220px;
  }
  .def p {
    margin: 0.2rem 0 0;
    color: var(--text-dim);
  }
</style>
