<script lang="ts">
  import { ruleset } from '../../stores';

  /** Rule-tag definitions page (§5.2). */
  $: defs = $ruleset.ruleTags;
  let newTag = '';

  function update(tag: string, description: string) {
    ruleset.update((r) => ({ ...r, ruleTags: r.ruleTags.map((d) => (d.tag === tag ? { ...d, description } : d)) }));
  }
  function add() {
    const t = newTag.trim();
    if (!t || defs.some((d) => d.tag.toLowerCase() === t.toLowerCase())) return;
    ruleset.update((r) => ({
      ...r,
      ruleTags: [...r.ruleTags, { tag: t, description: '' }],
      tags: r.tags.includes(t) ? r.tags : [...r.tags, t].sort(),
    }));
    newTag = '';
  }
  function remove(tag: string) {
    ruleset.update((r) => ({ ...r, ruleTags: r.ruleTags.filter((d) => d.tag !== tag) }));
  }
</script>

<section class="panel">
  <h3 style="margin-top:0">Rule-Tag Definitions</h3>
  <p class="faint" style="font-size:.83em">
    Rule tags (finesse, flourish…) show on actions; players hover them for these explanations. New rule
    tags typed while editing a skill prompt for a description inline, and also appear here.
  </p>
  <div class="row" style="margin-bottom:.6rem">
    <input placeholder="New rule tag" bind:value={newTag} on:keydown={(e) => e.key === 'Enter' && add()} />
    <button class="primary" on:click={add}>Add</button>
  </div>
  {#each defs as d (d.tag)}
    <div class="def">
      <span class="tag pill">{d.tag}</span>
      <input value={d.description} placeholder="Explanation…" on:input={(e) => update(d.tag, e.currentTarget.value)} />
      <button class="ghost small" on:click={() => remove(d.tag)} aria-label="Remove">✕</button>
    </div>
  {/each}
  {#if defs.length === 0}<p class="faint">No rule tags defined yet.</p>{/if}
</section>

<style>
  .def {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .tag {
    flex: 0 0 auto;
    min-width: 90px;
    text-align: center;
  }
  .def input {
    flex: 1;
  }
</style>
