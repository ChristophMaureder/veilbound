<script lang="ts">
  import { ruleset } from '../../stores';
  import type { Ruleset, SkillAction, ActionModifier } from '../../types';

  $: defs = $ruleset.ruleTags;
  let newTag = '';

  function renameTagInAction(a: SkillAction, oldTag: string, newTag: string): SkillAction {
    return {
      ...a,
      ruleTags: a.ruleTags.map((t) => (t === oldTag ? newTag : t)),
      findingTags: a.findingTags.map((t) => (t === oldTag ? newTag : t)),
    };
  }
  function renameTagInModifier(m: ActionModifier, oldTag: string, newTag: string): ActionModifier {
    return {
      ...m,
      actionTags: (m.actionTags ?? []).map((t) => (t === oldTag ? newTag : t)),
      addRuleTags: (m.addRuleTags ?? []).map((t) => (t === oldTag ? newTag : t)),
    };
  }

  function rename(oldTag: string, newName: string) {
    const n = newName.trim();
    if (!n || n === oldTag) return;
    ruleset.update((r: Ruleset) => ({
      ...r,
      ruleTags: r.ruleTags.map((d) => (d.tag === oldTag ? { ...d, tag: n } : d)),
      tags: r.tags.map((t) => (t === oldTag ? n : t)),
      standardActions: (r.standardActions ?? []).map((a) => renameTagInAction(a, oldTag, n)),
      modifiers: (r.modifiers ?? []).map((m) => renameTagInModifier(m, oldTag, n)),
      trees: r.trees.map((tree) => ({
        ...tree,
        nodes: tree.nodes.map((node) => ({
          ...node,
          actions: node.actions.map((a) => renameTagInAction(a, oldTag, n)),
          grants: node.grants.map((g) =>
            g.kind === 'attackmod' ? { ...g, modifier: renameTagInModifier(g.modifier, oldTag, n) } : g
          ),
        })),
      })),
      items: r.items.map((item) => ({
        ...item,
        actions: item.actions.map((a) => renameTagInAction(a, oldTag, n)),
        grants: item.grants.map((g) =>
          g.kind === 'attackmod' ? { ...g, modifier: renameTagInModifier(g.modifier, oldTag, n) } : g
        ),
      })),
    }));
  }

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
    Rule tags (finesse, flourish…) show on actions; players hover them for these explanations. Rename a tag to update it everywhere.
  </p>
  <div class="row" style="margin-bottom:.6rem">
    <input placeholder="New rule tag" bind:value={newTag} on:keydown={(e) => e.key === 'Enter' && add()} />
    <button class="primary" on:click={add}>Add</button>
  </div>
  {#each defs as d (d.tag)}
    <div class="def">
      <input
        class="tag-name"
        value={d.tag}
        title="Rename tag (updates everywhere)"
        on:blur={(e) => rename(d.tag, e.currentTarget.value)}
        on:keydown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), e.preventDefault())}
      />
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
  .tag-name {
    flex: 0 0 auto;
    width: 110px;
    font-size: 0.8em;
    font-weight: 600;
    border-radius: var(--radius-sm);
    background: rgba(124, 95, 212, 0.12);
    border: 1px solid rgba(124, 95, 212, 0.35);
    color: var(--accent-2);
    padding: 0.18em 0.5em;
    text-align: center;
  }
  .tag-name:focus {
    outline: 1px solid var(--accent);
    background: rgba(124, 95, 212, 0.22);
  }
  .def input:not(.tag-name) {
    flex: 1;
  }
</style>
