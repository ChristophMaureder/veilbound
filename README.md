# Veilbound

A character sheet and skill-tree builder for a tabletop RPG. It runs entirely in the
browser — **no backend, no accounts, no server**. All data lives in `localStorage`, and
characters/rulesets move between machines as JSON files. It is designed to be hosted as a
static site on **GitHub Pages**.

- **Players** create and manage characters, pour skill points into trees, track HP / mana /
  soul / rechargeable resources, and rest.
- **The GM** edits the *rules* — skill trees, formulas, the level-up table, resources, and
  armour — through a password-gated admin panel, then exports the ruleset JSON and commits it.

The GM password is a **soft gate only**: on a static site the rules and the password both
ship to every browser. That's acceptable for a trusting tabletop group.

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm test           # run the engine unit tests (Vitest)
```

## Deploying to GitHub Pages

1. Push to a repo named **`Veilbound`** (the Vite `base` is `/Veilbound/`).
   - Different repo name? Set `base` in `vite.config.ts`, or build with
     `VEILBOUND_BASE=/your-repo/ npm run build`.
   - User/org root or custom domain? Use `VEILBOUND_BASE=/`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds `dist/` and publishes it on every
   push to `main`. Visit `https://<user>.github.io/Veilbound/`.

No other configuration is required.

## How the rules engine works

Everything calculated is **data-driven**, so the GM can change it without touching code.

- **Stat tiers**: each character maps its four stats (STR/DEX/KNO/WIL) to tiers —
  primary / secondary / tertiary / quaternary — at creation.
- **Level-up table** (`levelTable`): one row per level 1–20 written in *tier* columns plus
  soul. Cells are **increments** (empty = no change); the **level-1 row sets the base**. A
  stat's value = its tier's base + the sum of later increments.
- **Formulas** (`formulas`): plain-arithmetic strings evaluated by a small safe parser
  (`src/lib/engine/formula.ts`) — **never `eval`**. `prof` is itself a level-driven formula
  (default `floor(level/4)+2`). Inputs: `level, STR, DEX, KNO, WIL, prof, crit, soul, damage`,
  plus functions `min, max, floor, ceil, round, abs, clamp`.
- **Formula interpolation**: effect text can embed `{{ … }}` formulas, which render as the
  computed number with a hover breakdown of the inputs.
- **Modifiers**: players never edit a calculated value directly. Click any stat/resource to
  open its popup; a subtle lock (🔒, top-right) gates adding named ± modifiers. Effective
  value = base + modifiers + grants from owned skills and equipped items.
- **Resources**: each has a `maxFormula` and numeric short/long-rest recovery amounts. **Mana
  is just a resource** that a skill grants (it slides into view when first granted).
- **Skill points** are not tied to levels — a sheet button grants an amount on demand.

Recalculation is instant and pure (`src/lib/engine/derive.ts`).

## Skill trees

Trees are **free-form node graphs** (`src/lib/engine/tree.ts`): each node lists its
prerequisite node(s), so branches may split, branch again, and merge freely — built in the
admin node/table editor.

- **Per-node visibility** to players: fully hidden (`???`), name only, name+description
  (prereq hidden), or fully visible — with a tree-level default. The GM (or the debug
  force-reveal) sees everything.
- **Per-node prerequisite** (free text): the player is only prompted to self-attest when a
  node actually has one.
- A node can **grant** an action, a resource (e.g. mana), or bonuses (+HP, +AC, +damage, a
  stat). Actions carry **finding tags** (hidden except during search) and **rule tags**
  (always shown, hover for the GM-defined explanation).
- Investing uses a **pour-points** model: *Just enough*, *All remaining* (overflow banks
  toward the next node as a filling border), or *Custom*. Detail opens in **list or node**
  view.
- **Unlearn** is gated behind a subtle lock in the node's popup; it then cascades to
  everything downstream and refunds the points.

Only trees marked **done** are shown to players; in-progress trees stay GM-only. If a ruleset
change leaves a character over budget, a warning shows and **nothing is auto-removed**.

## Inventory, items & combat

The GM builds items in the admin **Items** tab (grouped by category; add via a popup; expand a
row to edit). Items have equip-gated **grants** with a mode — **Add / Set / Multiply** — and
are **non-stacking per stat**: if any equipped item *Sets* a stat the highest Set wins,
otherwise the single highest resulting Add/Multiply applies (rings never sum). Skill grants and
manual modifiers still stack and form the pre-item value.

Players get items from a **Shop** (filter by name/partial/tag/category/level) into **containers**
shown in an adjustable masonry layout with per-container search; multi-select and drag items
between containers, toggle **Equipped**, and click a row to expand its details. Each container
shows its weight; the toolbar shows total load.

**Weapons** are items with one or more **use-modes** (slash / thrust / …), each with its own
dice-notation **damage** split by type — every damage type has an assignable colour and each
term is coloured and hover-labelled. **To-hit** = `prof + scale` where the scaling stat is set
per weapon/use-mode and can be overridden by a skill grant scoped to a tag (e.g. *longsword →
DEX*). Weapons declare a **main / secondary** slot. The level-up table **starts empty** — the
GM fills the tier columns in *Formulas & Table*.

## Project layout

```
src/
  lib/
    engine/        formula evaluator, character derivation, tree graph, rest rules, validation
    components/    Svelte UI (sheet, browser, tree view, learn) + admin/ editors
    types.ts       the full data model
    defaults.ts    seed ruleset + character factory
    stores.ts      app state + localStorage persistence
    selectors.ts   shared read helpers
  App.svelte       shell + view routing
```

## Saving, importing, exporting

- Characters and the ruleset autosave to `localStorage` on every change.
- **Export character** (sheet) / **Export ruleset** (admin) download JSON.
- **Import character** (Characters dialog) — on an id clash, choose *overwrite* or *copy*.
- **Import ruleset** (admin) — character progress is never deleted; players see a
  "ruleset changed" notice and resolve any affected skills themselves.

## Accessibility & motion

All animations (mana slide-in, staggered soul dots, ticking skill points, tooltip fades)
are disabled automatically when the OS has **reduce-motion** enabled.

## Notes on scope

Per the spec, **images are out of scope** for now — resource/soul dots use the default
filled/hollow circles, and nothing image-related is stored. This is intentional and called out
in the spec.
