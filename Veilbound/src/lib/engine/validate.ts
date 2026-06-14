// Ruleset validation for the GM debug tools. Returns human-readable issues.

import type { Ruleset } from '../types';
import { validateFormula } from './formula';
import { FORMULA_VARS, PROF_VARS, TOHIT_VARS } from './derive';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

export function validateRuleset(ruleset: Ruleset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (where: string, message: string) => issues.push({ severity: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ severity: 'warning', where, message });

  if (ruleset.levelTable.length === 0) warn('Level table', 'The level-up table is empty (fill it in Formulas & Table).');

  const profErr = validateFormula(ruleset.formulas.prof, PROF_VARS);
  if (profErr) err('Formula: prof', profErr);
  for (const key of ['hpMax', 'soulMax'] as const) {
    const e = validateFormula(ruleset.formulas[key], FORMULA_VARS);
    if (e) err(`Formula: ${key}`, e);
  }
  const thErr = validateFormula(ruleset.toHitFormula, TOHIT_VARS);
  if (thErr) err('Formula: to-hit', thErr);

  for (const r of ruleset.resources) {
    const e = validateFormula(r.maxFormula, FORMULA_VARS);
    if (e) err(`Resource "${r.label}" max`, e);
  }
  const resIds = new Set(ruleset.resources.map((r) => r.id));
  const dtIds = new Set(ruleset.damageTypes.map((d) => d.id));

  const treeIds = new Set<string>();
  for (const t of ruleset.trees) {
    if (treeIds.has(t.id)) err('Trees', `Duplicate tree id "${t.id}".`);
    treeIds.add(t.id);
    if (!t.name.trim()) warn(`Tree ${t.id}`, 'Tree has no name.');
    if (t.nodes.length === 0) warn(`Tree "${t.name}"`, 'Tree has no nodes.');
    const nodeIds = new Set(t.nodes.map((n) => n.id));
    let roots = 0;
    for (const n of t.nodes) {
      if (n.prereqNodeIds.length === 0) roots++;
      for (const p of n.prereqNodeIds) if (!nodeIds.has(p)) err(`Tree "${t.name}"`, `Node ${n.id} references missing node "${p}".`);
      if (n.cost < 0) err(`Tree "${t.name}" node ${n.id}`, 'Negative cost.');
      for (const g of n.grants) {
        if (g.kind === 'resource' && !resIds.has(g.resourceId)) err(`Tree "${t.name}" node ${n.id}`, `Grants unknown resource "${g.resourceId}".`);
      }
    }
    if (t.nodes.length > 0 && roots === 0) err(`Tree "${t.name}"`, 'No root node — nothing is learnable.');
  }

  const itemIds = new Set<string>();
  for (const i of ruleset.items) {
    if (itemIds.has(i.id)) err('Items', `Duplicate item id "${i.id}".`);
    itemIds.add(i.id);
    for (const g of i.grants) {
      if (g.kind === 'ac') {
        const lo = validateFormula(g.low, FORMULA_VARS);
        const hi = validateFormula(g.high, FORMULA_VARS);
        if (lo) err(`Item "${i.name}" AC low`, lo);
        if (hi) err(`Item "${i.name}" AC high`, hi);
      } else if (g.kind === 'resource' && !resIds.has(g.resourceId)) {
        err(`Item "${i.name}"`, `Grants unknown resource "${g.resourceId}".`);
      }
    }
    if (i.weapon) {
      for (const m of i.weapon.modes) {
        for (const term of m.damage) {
          if (!dtIds.has(term.typeId)) warn(`Item "${i.name}" mode "${m.name}"`, `Damage term has unknown type "${term.typeId}".`);
        }
      }
    }
  }

  return issues;
}
