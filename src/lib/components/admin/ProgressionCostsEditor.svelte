<script lang="ts">
  import { ruleset } from '../../stores';
  import type { TreeProgressionCosts, TreeRarity, TreeType } from '../../types';

  const LEVELS = 10;
  const TYPES: TreeType[] = ['skill', 'spell'];
  const RARITIES: TreeRarity[] = ['basic', 'expert', 'legendary'];
  const RARITY_LABELS: Record<TreeRarity, string> = { basic: 'Basic', expert: 'Expert', legendary: 'Legendary' };
  const TYPE_LABELS: Record<TreeType, string> = { skill: 'Skill', spell: 'Spell' };

  $: costs = $ruleset.treeProgressionCosts;

  const EMPTY_COSTS = (): TreeProgressionCosts => ({ skill: { basic: [], expert: [], legendary: [] }, spell: { basic: [], expert: [], legendary: [] } });

  function setCost(type: TreeType, rarity: TreeRarity, depth: number, value: number) {
    ruleset.update((r) => {
      const tc: TreeProgressionCosts = r.treeProgressionCosts
        ? JSON.parse(JSON.stringify(r.treeProgressionCosts))
        : EMPTY_COSTS();
      if (!tc[type]) (tc as unknown as Record<string, unknown>)[type] = { basic: [], expert: [], legendary: [] };
      if (!tc[type][rarity]) tc[type][rarity] = [];
      while (tc[type][rarity].length < LEVELS) tc[type][rarity].push(tc[type][rarity].at(-1) ?? 1);
      tc[type][rarity][depth] = Math.max(0, Math.round(value));
      return { ...r, treeProgressionCosts: tc };
    });
  }

  function costsFor(type: TreeType, rarity: TreeRarity): number[] {
    const arr = costs?.[type]?.[rarity] ?? [];
    const last = arr.at(-1) ?? 1;
    return Array.from({ length: LEVELS }, (_, i) => arr[i] ?? last);
  }
</script>

<div class="pce">
  {#each TYPES as type}
    <div class="block">
      <div class="block-head">{TYPE_LABELS[type]}</div>
      <table>
        <thead>
          <tr>
            <th class="lv-col">Level</th>
            {#each RARITIES as r}<th class="r-{r}">{RARITY_LABELS[r]}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each Array.from({ length: LEVELS }, (_, i) => i) as depth}
            <tr>
              <td class="lv-num">{depth + 1}</td>
              {#each RARITIES as rarity}
                <td>
                  <input
                    class="cost-in"
                    type="number"
                    min="0"
                    value={costsFor(type, rarity)[depth]}
                    on:input={(e) => setCost(type, rarity, depth, +e.currentTarget.value)}
                  />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
</div>

<style>
  .pce { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .block { display: flex; flex-direction: column; gap: 0.4rem; }
  .block-head { font-size: 0.76em; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim); font-weight: 600; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid var(--border); padding: 0.2rem 0.35rem; text-align: center; }
  th { font-size: 0.78em; background: var(--bg-3); color: var(--text-dim); }
  .lv-col { width: 3.5rem; }
  .lv-num { font-size: 0.8em; color: var(--text-faint); text-align: right; padding-right: 0.5rem; background: var(--bg-3); }
  .r-basic { color: var(--text); }
  .r-expert { color: #7ec8a8; }
  .r-legendary { color: #c8a44a; }
  .cost-in { width: 3.5rem; text-align: center; border: none; background: transparent; color: inherit; padding: 0.1rem; }
  .cost-in:focus { outline: 1px solid var(--accent-2); border-radius: 2px; }
</style>
