<script lang="ts">
  import { ruleset } from '../../stores';
  import { FORMULA_VARS } from '../../engine/derive';
  import type { Formulas, LevelRow, Tier } from '../../types';
  import { TIER_KEYS, TIER_LABELS } from '../../types';

  $: r = $ruleset;
  const FORMULA_FIELDS: { key: keyof Formulas; label: string; help: string }[] = [
    { key: 'prof', label: 'Proficiency (prof)', help: 'inputs: level only' },
    { key: 'hpMax', label: 'Max HP', help: '' },
    { key: 'soulMax', label: 'Max Soul', help: '' },
  ];
  const COLS: (Tier | 'soul')[] = [...TIER_KEYS, 'soul'];
  const COL_LABEL = (c: Tier | 'soul') => (c === 'soul' ? 'Soul' : TIER_LABELS[c].slice(0, 4));

  function setFormula(key: keyof Formulas, value: string) {
    ruleset.update((rs) => ({ ...rs, formulas: { ...rs.formulas, [key]: value } }));
  }
  function setHpRest(which: 'short' | 'long', v: number) {
    ruleset.update((rs) => (which === 'short' ? { ...rs, hpShortRest: v } : { ...rs, hpLongRest: v }));
  }
  function setUnarmoredAC(which: 'low' | 'high', v: string) {
    if (which === 'low') ruleset.update((rs) => ({ ...rs, unarmoredACLow: v }));
    else ruleset.update((rs) => ({ ...rs, unarmoredACHigh: v }));
  }
  function setCell(level: number, col: Tier | 'soul', raw: string) {
    const value = raw.trim() === '' ? null : Math.round(Number(raw));
    ruleset.update((rs) => ({
      ...rs,
      levelTable: rs.levelTable.map((row) => (row.level === level ? { ...row, [col]: value } : row)),
    }));
  }
</script>

<div class="ft">
  <section class="panel">
    <h3>Formulas</h3>
    <p class="faint" style="margin-top:0">
      Inputs: <span class="mono">{FORMULA_VARS.join(', ')}</span>. Functions:
      <span class="mono">min, max, floor, ceil, round, abs, clamp</span>. Safe parser (no eval).
    </p>
    <div class="formulas">
      {#each FORMULA_FIELDS as f}
        <div class="frow">
          <label>{f.label}{#if f.help}<span class="faint"> ({f.help})</span>{/if}</label>
          <input class="mono" value={r.formulas[f.key]} on:input={(e) => setFormula(f.key, e.currentTarget.value)} />
        </div>
      {/each}
    </div>
    <div class="frow" style="margin-top:.6rem">
      <label>Unarmored AC <span class="faint">(empty = none)</span></label>
      <div class="row" style="gap:.4rem;align-items:center">
        <input class="mono" style="flex:1" placeholder="low e.g. 10" value={r.unarmoredACLow ?? r.unarmoredAC ?? ''} on:input={(e) => setUnarmoredAC('low', e.currentTarget.value)} title="Low end of unarmored AC range" />
        <span class="faint">—</span>
        <input class="mono" style="flex:1" placeholder="high e.g. 13 + DEX" value={r.unarmoredACHigh ?? r.unarmoredACLow ?? r.unarmoredAC ?? ''} on:input={(e) => setUnarmoredAC('high', e.currentTarget.value)} title="High end of unarmored AC range (defaults to low if empty)" />
      </div>
    </div>
    <div class="row wrap" style="margin-top:.8rem;gap:1rem">
      <div class="col" style="gap:2px"><label>HP — short rest +</label>
        <input type="number" value={r.hpShortRest} on:input={(e) => setHpRest('short', Math.round(Number(e.currentTarget.value)))} style="width:90px" /></div>
      <div class="col" style="gap:2px"><label>HP — long rest +</label>
        <input type="number" value={r.hpLongRest} on:input={(e) => setHpRest('long', Math.round(Number(e.currentTarget.value)))} style="width:90px" /></div>
      <p class="faint" style="font-size:.82em;max-width:340px">Recovery is an amount restored (use a big number like 999 for “full”).</p>
    </div>
  </section>

  <section class="panel">
    <h3>Level-up table (by tier)</h3>
    <p class="faint" style="margin-top:0">
      Cells are increments per level; empty = no change. The level-1 row sets base values. Each stat is
      granted via its assigned tier; soul is granted directly.
    </p>
    <div class="tablewrap scrollbar">
      <table>
        <thead><tr><th>Lv</th>{#each COLS as c}<th>{COL_LABEL(c)}</th>{/each}</tr></thead>
        <tbody>
          {#each r.levelTable as row (row.level)}
            <tr>
              <td class="lv">{row.level}{#if row.level === 1}<span class="base">base</span>{/if}</td>
              {#each COLS as c}
                <td>
                  <input type="number" value={row[c] ?? ''} placeholder="—"
                    on:input={(e) => setCell(row.level, c, e.currentTarget.value)} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>

<style>
  .ft {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .formulas {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .frow {
    display: grid;
    grid-template-columns: 220px 1fr;
    align-items: center;
    gap: 0.6rem;
  }
  .frow input {
    width: 100%;
  }
  .tablewrap {
    overflow: auto;
    max-height: 380px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 2px;
    text-align: center;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--bg-3);
  }
  td.lv {
    font-weight: 700;
    background: var(--bg-2);
    position: relative;
  }
  .base {
    display: block;
    font-size: 0.6em;
    color: var(--accent);
    font-weight: 400;
  }
  td input {
    width: 60px;
    text-align: center;
    border: none;
    background: transparent;
  }
  td input:focus {
    background: var(--bg);
  }
</style>
