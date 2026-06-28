# Veilbound — GM Authoring Reference

Everything a GM needs to write skill trees, actions, items, modifiers, and formulas.

---

## Formula Syntax

Formulas are written as plain arithmetic expressions. They are never `eval`'d — only a safe parser runs them.

### Variables

| Variable  | Meaning |
|-----------|---------|
| `STR`     | Character's effective Strength (after grants) |
| `DEX`     | Effective Dexterity |
| `KNO`     | Effective Knowledge |
| `WIL`     | Effective Willpower |
| `level`   | Character level (1–20) |
| `prof`    | Proficiency (computed from the `prof` formula, e.g. `floor(level / 4) + 2`) |
| `crit`    | Crit modifier (−6..+6, set on the character sheet) |
| `soul`    | Soul value (read from the level-up table) |
| `damage`  | Global flat damage bonus (stacked from grants and equipped items) |
| `scale`   | **To-hit formulas only.** The stat chosen as the weapon's to-hit scaling stat. |
| `<resId>` | Any resource's **current** value (e.g. `aim`, `mana`). Use the resource's `id`. |

### Operators & functions

```
+  -  *  /  %  ^
min(a, b)   max(a, b)
floor(x)    ceil(x)    round(x)
abs(x)      clamp(x, lo, hi)
```

### Embedding formulas in text

Wrap any formula in `{{ }}` to embed it inside flavour or effect text:

```
On a hit, deal {{STR * 2 + damage}} damage.
Spend {{mana}} mana to double the effect.
```

Plain text outside `{{ }}` is shown as-is.

---

## Dice & Damage Notation

Used in **damage fields**, **weapon damage terms**, and `{{ }}` embedded expressions.

### Basic dice

```
2d6          — two six-sided dice
1d8          — one eight-sided die
2d6 + 3      — dice plus a flat bonus
```

Dice and flats of the **same damage type** automatically combine: `1d8 + 1d8 + 4 slashing` displays as `2d8 + 4 slashing`.

### Damage types

Append the damage type **name** after a term to colour it. Any untyped term inherits the type to its left.

```
2d6 Slashing              — coloured slashing
1d8 Slashing + 2d4 Fire   — two coloured terms
1d8 + 2 Slashing          — both terms are slashing
```

Type names must exactly match a damage type defined in the ruleset (case-insensitive).

### Weapon references — `main` and `side`

Available in action `attackDamage` fields, modifier `attackDamage` fields, and `{{ }}` expressions when the action is linked to a weapon.

| Expression      | Meaning |
|----------------|---------|
| `main`          | Main-hand weapon's damage (dice + flat + type) |
| `side`          | Off-hand weapon's damage |
| `2 * main`      | Double the weapon damage (e.g. 1d8+2 → 2d8+4) |
| `main + side`   | Both weapons combined, same-type terms merged |
| `aim * main`    | Scale by current value of the `aim` resource |

`main` / `side` expand to the full serialised damage string of the weapon's active mode, including the damage type. Multiplying scales both the dice count and the flat bonus.

---

## Proficiency formula (`prof`)

Evaluated first; the result is then available to all other formulas.

Default: `floor(level / 4) + 2`

---

## To-hit formula (global)

Stored in `ruleset.toHitFormula`. Evaluated per weapon mode.

Default: `prof + scale`

Where `scale` is the value of the stat chosen for that weapon mode's `scaleToHit`. Additional variables: `level`, `STR`, `DEX`, `KNO`, `WIL`, `crit`, `prof`.

---

## Rule Tags vs Finding Tags

### Rule tags (`ruleTags`)

- **Always visible** on action cards and node tooltips.
- Players can hover for a definition (you write those in the ruleset's tag list).
- Used for eligibility matching: modifiers compare against `ruleTags` to determine which actions they can be toggled onto.
- Examples: `attack`, `martial`, `spell`, `reaction`, `defenseless`

### Finding tags (`findingTags`)

- **Hidden** from players; only used internally for searching and filtering.
- Good for weapon-specific categories (`longsword`, `bow`) that you don't want cluttering the card.

### Global tags

Maintained as a flat list in the ruleset. Used to tag **skill trees** and **items** for filtering in the skill browser and shop. Not the same as rule tags.

---

## Standard Actions

Global actions every character owns. Defined in `ruleset.standardActions`.

```
id          — stable identifier (never reuse)
name        — display name
cost        — "1 Action" / "2 Actions" / "Reaction" / any string
ruleTags    — always-shown tags (e.g. ["attack", "martial"])
findingTags — hidden search tags
flavour     — italic flavour text (no formulas)
effect      — effect text; embed {{formula}} freely
resource    — null | { resourceId, mode: "consume"|"grant", amount }
weaponTarget  — "" | "main" | "secondary"  (links card to a weapon slot)
weaponMode    — specific mode name to use (empty = first mode)
showWeaponInfo — false to hide the to-hit/damage line (default true)
attackDamage   — additive damage expression (e.g. "3 * main", "2d8 Fire")
attackToHit    — additive to-hit formula (e.g. "2", "prof")
```

`weaponTarget` must be set for the attack box (to-hit + damage) to appear. When `attackDamage` is set it **replaces** the base weapon damage with the expression; when `attackToHit` is set it **adds** on top of the computed to-hit.

---

## Attack Modifiers

Defined in `ruleset.modifiers` (global pool) or granted by skill nodes / items via an `attackmod` grant.

### Modifier types

**Martial modifiers** (`stackable: false` or omitted) — apply only to non-spell actions. Radio-select: one at a time per action card. They modify the weapon attack's damage and to-hit.

**Spell modifiers** (`stackable: true`) — apply only to actions with `isSpell: true`. Multi-select: multiple layers can be active at once. They modify the spell's displayed Range, Target, and add damage badges.

```
id           — stable identifier
name         — display name (shown on the toggle button)
targetMode   — "tags" | "spells"  — how this modifier finds eligible actions
actionTags   — (targetMode "tags") action must have ≥1 of these in ruleTags; empty = ["attack"]
spellNames   — (targetMode "spells") action name must match one of these (case-insensitive)
attackType   — restrict to weapon modes with this attackType (e.g. "slash", "thrust"); empty = any
stackable    — true = spell modifier (multi-select layers); false/omit = martial modifier (radio)
addRuleTags  — tags applied to the action while this modifier is active (e.g. ["defenseless"])
effect       — text shown when active; embed {{formula}} freely
flavour      — short tooltip text
resource     — null | { resourceId, mode: "consume"|"grant", amount }
```

**Martial-only fields** (ignored for spell modifiers):
```
attackDamage — additive damage added on top of the base attack (e.g. "2d8 Fire", "main")
attackToHit  — additive to-hit formula (e.g. "2", "prof")
```

**Spell-only fields** (only meaningful when `stackable: true`):
```
spellDamageAdd      — extra damage shown as a badge on the spell card (e.g. "+1d6 Fire")
spellRangeAdd       — ft added to the spell's numeric range (e.g. 15 → "15 ft" + 15 = "30 ft")
spellRangeOverride  — absolute range replacement when numeric add is not appropriate (e.g. "90 ft")
                      takes priority over spellRangeAdd; use when the range isn't a simple addition
spellTargetsAdd     — integer added to the leading number in the target field (e.g. +1 → "3 creatures")
spellTargetsOverride— absolute target replacement (e.g. "any (2 per mana)")
                      takes priority over spellTargetsAdd
```

### Targeting modes

**`targetMode: "tags"`** — modifier appears on any action whose `ruleTags` contains at least one of `actionTags`. If `actionTags` is empty it defaults to `["attack"]`.

**`targetMode: "spells"`** — modifier appears on actions whose `name` (case-insensitive) matches any entry in `spellNames`. Use this for spell-specific layers.

### How spell modifiers display

When one or more spell layers are active on a spell card:
- **Range** — if `spellRangeOverride` is set it replaces the displayed range entirely; else `spellRangeAdd` is summed onto the numeric value of the base range (e.g. base "15 ft" + 15 = "30 ft"). Modified values are highlighted in blue.
- **Target** — if `spellTargetsOverride` is set it replaces the displayed target entirely; else `spellTargetsAdd` is added to the leading number (e.g. base "2 creatures" + 1 = "3 creatures"). Modified values are highlighted in blue.
- **Damage** — `spellDamageAdd` strings from all active layers are shown as "+X" badges below the effect text.
- **Effect text** — shown beneath damage badges; embed `{{formula}}` freely for complex descriptions.

When active the card's Use button spends **both** the action's resource and every active modifier's resource simultaneously.

---

## Skill Trees

### Tree fields

```
id           — stable identifier
name         — display name
description  — shown to players
tags         — global tags (used by skill browser filters)
category     — top-level grouping (e.g. "Combat", "Magic")
subcategory  — optional second-level grouping within a category
status       — "inProgress" | "done"  (only "done" trees show to players)
nodes        — array of SkillNode
requirements — optional array of TreeRequirement (see below)
```

### Node fields

```
id              — stable identifier (must be unique within the tree)
name            — display name
cost            — skill-point cost (integer, default 2)
description     — shown to players
prerequisite    — narrative gate text (displayed as a prompt, not enforced mechanically)
prereqNodeIds   — array of node ids; owning ANY ONE satisfies the edge (OR logic)
exclusive       — if true, once a successor is owned the other branches are locked
actions         — array of SkillAction granted when this node is owned
grants          — array of Grant applied when this node is owned
hideName        — hide name from players until owned
hideDescription — hide description from players until owned
hidePrerequisite— hide prerequisite text from players
```

Multiple `prereqNodeIds` means "any one of these". To require ALL, chain through a shared intermediate node.

---

## Tree Requirements

Gate an entire tree behind a hard condition. Players see a lock and must explicitly unlock it.

### `treeLevel` — nodes invested in another tree

```json
{ "kind": "treeLevel", "treeId": "tree_longsword", "min": 5 }
```

Requires at least 5 owned nodes in Longsword Mastery.

### `subcatLevel` — breadth across a subcategory

```json
{ "kind": "subcatLevel", "subcategory": "Melee", "level": 3, "count": 2 }
```

Requires at least 2 trees in the "Melee" subcategory each with ≥ 3 owned nodes.

### `stat` — minimum effective stat

```json
{ "kind": "stat", "stat": "STR", "min": 14 }
```

---

## Grants

Applied whenever a skill node is owned or an item is equipped.

### `resource` — grant max resource capacity

```json
{ "kind": "resource", "resourceId": "mana", "amount": 6 }
```

Increases the character's **maximum** for that resource by `amount`. Stacks across all owned nodes.

### `modifier` — add/set/multiply a stat or derived value

```json
{ "kind": "modifier", "target": "STR", "value": 2, "mode": "add" }
```

| `target`  | What it modifies |
|-----------|-----------------|
| `STR` `DEX` `KNO` `WIL` | Core stat |
| `hpMax`   | Maximum HP |
| `soulMax` | Maximum Soul |
| `ac`      | Armour Class |
| `damage`  | Global flat damage bonus |
| `<resId>` | A resource's maximum |

`mode` values: `"add"` (stacks), `"set"` (overrides; highest set wins), `"mul"` (multiplies after adds).

### `ac` — armour-class grant

```json
{ "kind": "ac", "low": "9 - floor(DEX / 4)", "high": "13 + floor(DEX / 4)" }
```

Provides an AC range. `low` and `high` are formulas. The player chooses a value within the range each turn. `mode` defaults to `"set"` (replaces unarmored); use `"adjust"` to add on top.

### `scaling` — change which stat scales a weapon

```json
{ "kind": "scaling", "tag": "longsword", "attackTag": "", "toHit": "DEX", "damage": "DEX" }
```

Overrides the scaling stat for weapons whose item tags include `tag`. `attackTag` can further restrict to a specific attack-mode tag. Empty string for `toHit` or `damage` means "no override".

### `dmgbonus` — conditional flat damage / to-hit bonus

```json
{
  "kind": "dmgbonus",
  "weaponTag": "longsword",
  "attackName": "",
  "attackType": "thrust",
  "toHitBonus": "",
  "formula": "prof",
  "damageTypeId": "dt_pierce"
}
```

All non-empty filter fields must match (AND logic):

| Filter field  | Matches when |
|--------------|-------------|
| `weaponTag`   | The equipped weapon's item tags include this |
| `attackName`  | The attack's name matches exactly |
| `attackType`  | The weapon mode's `attackType` matches |

`formula` is evaluated as a flat number and appended to the damage. `damageTypeId` sets the colour. `toHitBonus` is an optional additive to-hit formula.

### `addmode` — grant extra weapon use-modes

```json
{
  "kind": "addmode",
  "weaponTags": ["longsword"],
  "mode": { "name": "Pommel Strike", "attackType": "blunt", "damage": [...], "scaleToHit": "STR", "scaleDamage": "STR", "toHitBonus": 0 }
}
```

Adds a new use-mode to any equipped weapon whose tags include any entry in `weaponTags`. Empty `weaponTags` applies to all weapons. The `mode` has the same structure as a weapon's built-in modes.

### `attackmod` — grant a play-time attack modifier

```json
{ "kind": "attackmod", "modifier": { ...ActionModifier... } }
```

Embeds a full `ActionModifier` (see above). Appears in the modifier picker on matching action cards when the node is owned / item is equipped.

---

## Weapons

Defined on an `ItemDef` in `weapon.modes`. Each mode is an independent attack option.

```
name         — display name (e.g. "Slash", "Thrust")
attackType   — tag for mode-specific grants (e.g. "slash", "thrust"); empty = untagged
damage       — array of DamageTerm
damageTwoHanded — optional array of DamageTerm used when the player activates 2H grip
scaleToHit   — "STR" | "DEX" | "KNO" | "WIL" | ""  (empty = use global default from the ruleset)
scaleDamage  — same options
toHitBonus   — flat integer bonus to to-hit (on top of the formula)
```

### DamageTerm

```
notation  — dice or flat: "1d8", "1d6", "5"
typeId    — id of a DamageType in ruleset.damageTypes
```

---

## Armour & Shields

### Armour (AC grant on an item)

Add an `ac` grant to the item's `grants` array:

```json
{ "kind": "ac", "low": "9 - floor(DEX / 4)", "high": "13 + floor(DEX / 4)" }
```

Both `low` and `high` are formulas evaluated against character stats.

### Shield

Set `shield` on the `ItemDef`:

```json
{ "dr": "2" }
```

`dr` is a damage-reduction formula (e.g. `"floor(STR / 4)"`).

---

## Resources

```
id           — stable identifier (used in formulas and action costs)
label        — display name
type         — "dots" | "number" | "bar"
maxFormula   — formula for maximum value (e.g. "3", "KNO * 2 + WIL")
colour       — hex colour for the UI
shortRest    — amount restored on a short rest
longRest     — amount restored on a long rest (use 999 for full restore)
alwaysVisible— true = show even before any skill grants capacity
```

A resource with `maxFormula: "0"` is invisible until a skill node or item adds capacity via a `resource` grant.

---

## Items

```
id          — stable identifier
name        — display name
description — lore or mechanical text
level       — suggested acquisition level
category    — grouping (matches itemCategories in ruleset)
tags        — used by grant filters (e.g. "longsword", "armour", "light")
weight      — inventory weight
flavour     — italic flavour text
grants      — applied while equipped
actions     — extra action cards shown when item is expanded
weapon      — WeaponDef | null
shield      — ShieldDef | null
```

Grants on items are **only active while the item is equipped**.

---

## Presets

GM-authored character starting points. Players can apply the whole preset or individual sections.

```
id                — stable identifier
name              — display name
description       — shown to the player
statTiers         — suggested { STR/DEX/KNO/WIL: "pri"|"sec"|"tert"|"quat" }
standardActionIds — which standard actions to keep visible (others hidden)
actionTabs        — action view tabs to seed
skillTabs         — skill browser tabs to seed
pinnedTreeIds     — trees to pin into a generated tab
```

Any section may be omitted; only present sections are applied when the player uses the preset.

---

## Quick Reference — Formula Variables by Context

| Context | Available variables |
|---------|-------------------|
| `prof` formula | `level` |
| `hpMax`, `soulMax` | `level`, `STR`, `DEX`, `KNO`, `WIL`, `prof`, `crit`, `soul` |
| Resource `maxFormula` | same as above |
| Action / modifier `effect` text (`{{ }}`) | all of the above + `damage` + any resource id (current value) |
| Action `attackDamage` / modifier `attackDamage` | same + `main`, `side` (when weapon is linked) |
| Action `attackToHit` / modifier `attackToHit` | same as effect text (no `main`/`side`) |
| Global `toHitFormula` | `level`, `STR`, `DEX`, `KNO`, `WIL`, `prof`, `crit`, `scale` |
| `dmgbonus` `formula` | all character stats (evaluated as a flat number) |
| `ac` `low` / `high` | all character stats |
| Shield `dr` | all character stats |

---

## Complete Example — Skill Tree JSON

The legend below describes choices made in the JSON. Drop any `.json` file into `src/lib/ImportedRules/SkillTrees/` and it will be auto-loaded.

**Legend:**
- Root node has no `prereqNodeIds` (or empty array).
- `isSpell: true` on an action marks it as a spell — spell-targeted modifiers can match it.
- `reach` and `range` are separate; a melee spell can have both.
- `hideName`/`hideDescription` hide the node from players until purchased.
- `exclusive: true` on a branching node means players can only go down one path.
- `prereqNodeIds` with two entries means "own ANY ONE of these" (OR logic).
- Grant kinds shown: `resource`, `modifier`, `ac`, `scaling`, `dmgbonus`, `addmode`, `attackmod`, `actionext`.
- `targetMode: "spells"` + `spellNames` targets a modifier at a named spell action.
- `targetMode: "tags"` + `actionTags` targets by rule tags.
- `stackable: true` makes a modifier a spell layer (applies only to `isSpell` actions, multi-select).
- `stackable: false`/omit makes it a martial modifier (applies only to non-spell actions, radio-select).
- `spellDamageAdd`, `spellRangeAdd`, `spellRangeOverride`, `spellTargetsAdd`, `spellTargetsOverride` drive the live spell card display when layers are active.

```json
{
  "id": "tree_arcane_blade",
  "name": "Arcane Blade",
  "description": "Weave arcane power into your swordwork. Requires longsword training and magical talent.",
  "tags": ["combat", "magic", "longsword", "melee", "spellcasting"],
  "category": "Combat",
  "subcategory": "Melee",
  "status": "done",
  "treeType": "spell",
  "rarity": "expert",
  "requirements": [
    { "id": "req_tree", "kind": "treeLevel", "treeId": "tree_longsword", "min": 3 },
    { "id": "req_subcat", "kind": "subcatLevel", "subcategory": "Magic", "level": 2, "count": 1 },
    { "id": "req_stat", "kind": "stat", "stat": "KNO", "min": 12 }
  ],
  "nodes": [
    {
      "id": "ab1",
      "name": "Arcane Conduit",
      "cost": 2,
      "description": "Channel arcane energy through your blade. Gain a small pool of arcane charge.",
      "prerequisite": "",
      "prereqNodeIds": [],
      "exclusive": false,
      "hideName": false,
      "hideDescription": false,
      "hidePrerequisite": false,
      "grants": [
        { "id": "g_ab1_res", "kind": "resource", "resourceId": "mana", "amount": 4 }
      ],
      "actions": [
        {
          "id": "act_ab1_arcane_strike",
          "name": "Arcane Strike",
          "cost": "1 Action",
          "findingTags": ["longsword", "arcane"],
          "ruleTags": ["attack", "spell", "martial"],
          "flavour": "Your blade crackles with pale blue light.",
          "effect": "Strike for {{STR + KNO + damage}} damage. Consume 1 mana to add {{KNO}} arcane damage.",
          "resource": { "resourceId": "mana", "mode": "consume", "amount": 1 },
          "weaponTarget": "main",
          "weaponMode": "",
          "showWeaponInfo": true,
          "reach": "5 ft",
          "range": "Touch",
          "target": "1 creature",
          "isSpell": true
        }
      ]
    },
    {
      "id": "ab2",
      "name": "Spell Edge",
      "cost": 3,
      "description": "Your strikes deal additional arcane damage on a thrust.",
      "prerequisite": "Must have cast Arcane Strike at least once.",
      "prereqNodeIds": ["ab1"],
      "exclusive": false,
      "hideName": false,
      "hideDescription": false,
      "hidePrerequisite": false,
      "grants": [
        {
          "id": "g_ab2_dmg",
          "kind": "dmgbonus",
          "weaponTag": "longsword",
          "attackName": "",
          "attackType": "thrust",
          "toHitBonus": "1",
          "formula": "KNO",
          "damageTypeId": "dt_pierce"
        },
        {
          "id": "g_ab2_mod_martial",
          "kind": "attackmod",
          "modifier": {
            "id": "mod_ab2_arcane_focus",
            "name": "Arcane Focus",
            "targetMode": "tags",
            "actionTags": ["martial"],
            "spellNames": [],
            "attackType": "thrust",
            "attackDamage": "1d6",
            "attackToHit": "prof",
            "addRuleTags": [],
            "effect": "Channel arcane power into the thrust: +1d6 damage and +prof to hit.",
            "flavour": "You pour yourself into the strike.",
            "resource": { "resourceId": "mana", "mode": "consume", "amount": 1 },
            "stackable": false
          }
        },
        {
          "id": "g_ab2_mod_spell",
          "kind": "attackmod",
          "modifier": {
            "id": "mod_ab2_surge",
            "name": "Arcane Surge",
            "targetMode": "spells",
            "actionTags": [],
            "spellNames": ["Arcane Strike"],
            "attackType": "",
            "attackDamage": "",
            "attackToHit": "",
            "addRuleTags": [],
            "effect": "The arcane surge crackles through nearby allies.",
            "flavour": "Power radiates outward.",
            "resource": { "resourceId": "mana", "mode": "consume", "amount": 1 },
            "stackable": true,
            "spellDamageAdd": "+1d6 Arcane",
            "spellRangeAdd": 10,
            "spellTargetsAdd": 1
          }
        }
      ],
      "actions": [
        {
          "id": "act_ab2_blade_surge",
          "name": "Blade Surge",
          "cost": "1 Action",
          "findingTags": ["longsword", "arcane"],
          "ruleTags": ["attack", "martial"],
          "flavour": "",
          "effect": "Lunge forward and strike for {{STR * 2 + damage}} damage.",
          "resource": null,
          "weaponTarget": "main",
          "weaponMode": "Thrust",
          "showWeaponInfo": true,
          "attackDamage": "2 * main",
          "attackToHit": "2",
          "reach": "",
          "range": "",
          "target": "1 creature",
          "isSpell": false
        }
      ]
    },
    {
      "id": "ab3",
      "name": "The Divergence",
      "cost": 2,
      "description": "Choose your mastery: raw arcane might or defensive warding.",
      "prerequisite": "",
      "prereqNodeIds": ["ab2"],
      "exclusive": true,
      "hideName": false,
      "hideDescription": false,
      "hidePrerequisite": false,
      "grants": [],
      "actions": []
    },
    {
      "id": "ab4a",
      "name": "Void Slash",
      "cost": 4,
      "description": "Path of Might. Tear through reality with each blow.",
      "prerequisite": "",
      "prereqNodeIds": ["ab3"],
      "exclusive": false,
      "hideName": false,
      "hideDescription": false,
      "hidePrerequisite": false,
      "grants": [
        { "id": "g_ab4a_sc", "kind": "scaling", "tag": "longsword", "attackTag": "slash", "toHit": "KNO", "damage": "KNO" },
        {
          "id": "g_ab4a_ext",
          "kind": "actionext",
          "actionTag": "spell",
          "target": "",
          "range": "+10 ft"
        }
      ],
      "actions": []
    },
    {
      "id": "ab4b",
      "name": "Arcane Ward",
      "cost": 4,
      "description": "Path of Warding. Your magic forms a protective shell.",
      "prerequisite": "",
      "prereqNodeIds": ["ab3"],
      "exclusive": false,
      "hideName": true,
      "hideDescription": true,
      "hidePrerequisite": false,
      "grants": [
        { "id": "g_ab4b_ac", "kind": "ac", "low": "10 + floor(KNO / 4)", "high": "14 + floor(KNO / 2)", "mode": "set" },
        { "id": "g_ab4b_mod", "kind": "modifier", "target": "KNO", "value": 1, "mode": "add" }
      ],
      "actions": []
    },
    {
      "id": "ab5",
      "name": "Blade Mastery",
      "cost": 5,
      "description": "The pinnacle of the arcane blade — reachable from either path.",
      "prerequisite": "",
      "prereqNodeIds": ["ab4a", "ab4b"],
      "exclusive": false,
      "hideName": false,
      "hideDescription": false,
      "hidePrerequisite": false,
      "grants": [
        {
          "id": "g_ab5_addmode",
          "kind": "addmode",
          "weaponTags": ["longsword"],
          "mode": {
            "id": "m_ab5_arcane",
            "name": "Arcane Edge",
            "attackType": "arcane",
            "damage": [{ "id": "d_ab5_1", "notation": "2d8", "typeId": "dt_fire" }],
            "scaleToHit": "KNO",
            "scaleDamage": "KNO",
            "toHitBonus": 2
          }
        }
      ],
      "actions": []
    }
  ]
}
```
