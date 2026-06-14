<script lang="ts">
  import { ruleset, forceReveal, importRuleset, resetRulesetToDefault, wipeAllData } from '../stores';
  import { validateRuleset, type ValidationIssue } from '../engine/validate';
  import { RULESET_SCHEMA } from '../defaults';
  import type { Ruleset } from '../types';
  import { downloadJSON } from '../util';
  import TreeEditor from './admin/TreeEditor.svelte';
  import ItemEditor from './admin/ItemEditor.svelte';
  import ResourceEditor from './admin/ResourceEditor.svelte';
  import RuleTagEditor from './admin/RuleTagEditor.svelte';
  import FormulaTableEditor from './admin/FormulaTableEditor.svelte';

  type Tab = 'trees' | 'items' | 'resources' | 'ruletags' | 'formulas' | 'settings' | 'data';
  let tab: Tab = 'trees';
  const TABS: [Tab, string][] = [
    ['trees', 'Skill Trees'],
    ['items', 'Items'],
    ['resources', 'Resources'],
    ['ruletags', 'Rule Tags'],
    ['formulas', 'Formulas & Table'],
    ['settings', 'Settings'],
    ['data', 'Import / Export · Debug'],
  ];

  $: r = $ruleset;
  let issues: ValidationIssue[] | null = null;
  let importMsg = '';
  let fileInput: HTMLInputElement;
  let confirmWipe = false;

  function setName(v: string) {
    ruleset.update((rs) => ({ ...rs, name: v }));
  }
  function setPassword(v: string) {
    ruleset.update((rs) => ({ ...rs, password: v }));
  }
  function publish() {
    ruleset.update((rs) => ({ ...rs, version: rs.version + 1 }));
  }
  function exportRuleset() {
    downloadJSON('veilbound-ruleset.json', r);
  }
  async function onFile(e: Event) {
    importMsg = '';
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Ruleset;
      if (!data || !Array.isArray(data.trees) || !data.formulas || !Array.isArray(data.levelTable)) {
        importMsg = 'That does not look like a Veilbound ruleset.';
        return;
      }
      if (data.schema !== RULESET_SCHEMA) importMsg = `Warning: schema ${data.schema} differs from this app (${RULESET_SCHEMA}). Imported anyway.`;
      importRuleset(data);
      if (!importMsg) importMsg = 'Ruleset imported. Character progress was preserved.';
    } catch {
      importMsg = 'Could not read that file.';
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }
  function runValidate() {
    issues = validateRuleset(r);
  }
</script>

<div class="admin">
  <div class="row wrap header">
    <h2 style="margin:0">GM Admin</h2>
    <span class="pill">v{r.version} · schema {r.schema}</span>
    <span class="spacer"></span>
    <button class="primary small" on:click={publish} title="Increment version so players see a 'ruleset changed' notice">⬆ Publish (bump version)</button>
  </div>

  <div class="tabs row wrap">
    {#each TABS as [id, label]}
      <button class="tab" class:active={tab === id} on:click={() => (tab = id)}>{label}</button>
    {/each}
  </div>

  {#if tab === 'trees'}<TreeEditor />
  {:else if tab === 'items'}<ItemEditor />
  {:else if tab === 'resources'}<ResourceEditor />
  {:else if tab === 'ruletags'}<RuleTagEditor />
  {:else if tab === 'formulas'}<FormulaTableEditor />
  {:else if tab === 'settings'}
    <section class="panel col" style="gap:.8rem;max-width:520px">
      <div class="f"><label>Ruleset name</label><input value={r.name} on:input={(e) => setName(e.currentTarget.value)} /></div>
      <div class="f"><label>GM password (soft gate)</label><input value={r.password} on:input={(e) => setPassword(e.currentTarget.value)} /></div>
      <p class="faint" style="font-size:.84em">On a static site this password ships to every browser; it only keeps honest players out.</p>
    </section>
  {:else if tab === 'data'}
    <div class="col" style="gap:1rem">
      <section class="panel">
        <h3 style="margin-top:0">Export / Import ruleset</h3>
        <div class="row wrap">
          <button class="primary" on:click={exportRuleset}>⬇ Export ruleset JSON</button>
          <button on:click={() => fileInput.click()}>⬆ Import ruleset…</button>
          <input bind:this={fileInput} type="file" accept="application/json,.json" on:change={onFile} hidden />
        </div>
        {#if importMsg}<p class="msg">{importMsg}</p>{/if}
        <p class="faint" style="font-size:.84em">Importing never deletes character progress; affected skills are simply marked for the player to resolve.</p>
      </section>
      <section class="panel">
        <h3 style="margin-top:0">Debug tools</h3>
        <label class="row" style="gap:.4rem"><input type="checkbox" checked={$forceReveal} on:change={(e) => forceReveal.set(e.currentTarget.checked)} /> Force-reveal all hidden content</label>
        <div class="row wrap" style="margin-top:.6rem">
          <button on:click={runValidate}>✓ Validate ruleset</button>
          <button class="danger" on:click={resetRulesetToDefault}>↺ Reset ruleset to default</button>
          {#if !confirmWipe}
            <button class="danger" on:click={() => (confirmWipe = true)}>🗑 Wipe all stored data</button>
          {:else}
            <span class="badge-warn row">Delete ALL characters and the ruleset?
              <button class="small" on:click={() => (confirmWipe = false)}>Cancel</button>
              <button class="small danger" on:click={() => { wipeAllData(); confirmWipe = false; }}>Yes, wipe</button>
            </span>
          {/if}
        </div>
        {#if issues}
          <div class="issues">
            {#if issues.length === 0}<p class="ok">No problems found. ✓</p>
            {:else}{#each issues as i}
              <div class="issue {i.severity}"><span class="sev">{i.severity}</span><span class="where">{i.where}</span><span class="msg2">{i.message}</span></div>
            {/each}{/if}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .admin {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .header {
    align-items: center;
  }
  .tabs {
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
  }
  .tab {
    border-radius: 999px;
  }
  .tab.active {
    background: var(--gold);
    color: #2a2410;
    border-color: var(--gold);
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .msg {
    color: var(--accent);
    font-size: 0.9em;
  }
  .issues {
    margin-top: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .ok {
    color: var(--good);
  }
  .issue {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    font-size: 0.88em;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.5rem;
  }
  .issue.error {
    border-color: #6b2d2d;
  }
  .sev {
    text-transform: uppercase;
    font-size: 0.72em;
    font-weight: 700;
  }
  .issue.error .sev {
    color: var(--bad);
  }
  .issue.warning .sev {
    color: var(--warn);
  }
  .where {
    font-weight: 600;
  }
  .msg2 {
    color: var(--text-dim);
  }
</style>
