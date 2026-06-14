import { describe, it, expect } from 'vitest';
import { evalFormula, evalInt, validateFormula } from './formula';

describe('evalFormula', () => {
  it('basic arithmetic with precedence', () => {
    expect(evalFormula('1 + 2 * 3', {}).value).toBe(7);
    expect(evalFormula('(1 + 2) * 3', {}).value).toBe(9);
    expect(evalFormula('10 - 2 - 3', {}).value).toBe(5); // left assoc
    expect(evalFormula('2 ^ 3 ^ 2', {}).value).toBe(512); // right assoc
  });

  it('unary minus and plus', () => {
    expect(evalFormula('-5 + 3', {}).value).toBe(-2);
    expect(evalFormula('3 * -2', {}).value).toBe(-6);
    expect(evalFormula('-(2 + 3)', {}).value).toBe(-5);
  });

  it('resolves variables', () => {
    const ctx = { level: 5, STR: 3, prof: 2 };
    expect(evalFormula('10 + level * 2 + STR * 3 + prof', ctx).value).toBe(31);
  });

  it('supports whitelisted functions', () => {
    expect(evalFormula('floor(7 / 2)', {}).value).toBe(3);
    expect(evalFormula('ceil(7 / 2)', {}).value).toBe(4);
    expect(evalFormula('min(3, 5, 1)', {}).value).toBe(1);
    expect(evalFormula('max(3, 5, 1)', {}).value).toBe(5);
    expect(evalFormula('clamp(12, 0, 6)', {}).value).toBe(6);
  });

  it('treats division/modulo by zero as 0 instead of NaN/Infinity', () => {
    expect(evalFormula('5 / 0', {}).value).toBe(0);
    expect(evalFormula('5 % 0', {}).value).toBe(0);
  });

  it('empty formula is 0', () => {
    expect(evalFormula('', {}).value).toBe(0);
    expect(evalFormula('   ', {}).value).toBe(0);
  });

  it('reports errors instead of throwing', () => {
    expect(evalFormula('1 +', {}).error).toBeTruthy();
    expect(evalFormula('foo + 1', {}).error).toMatch(/Unknown variable/);
    expect(evalFormula('bar(1)', {}).error).toMatch(/Unknown function/);
    expect(evalFormula('1 ) 2', {}).error).toBeTruthy();
    expect(evalFormula('@', {}).error).toMatch(/Unexpected character/);
  });

  it('does not execute arbitrary JS', () => {
    // These would be dangerous under eval(); here they are just parse errors.
    expect(evalFormula('constructor', {}).error).toMatch(/Unknown variable/);
    expect(evalFormula('1; alert(1)', {}).error).toBeTruthy();
  });

  it('evalInt rounds', () => {
    expect(evalInt('7 / 2', {})).toBe(4);
    expect(evalInt('5 / 2', {})).toBe(3);
  });
});

describe('validateFormula', () => {
  it('passes for allowed vars', () => {
    expect(validateFormula('STR * 2 + prof', ['STR', 'prof'])).toBeNull();
  });
  it('fails for disallowed vars', () => {
    expect(validateFormula('STR * mystery', ['STR'])).toMatch(/Unknown variable/);
  });
});
