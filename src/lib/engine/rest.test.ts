import { describe, it, expect } from 'vitest';
import { applyRecovery } from './rest';

describe('applyRecovery', () => {
  it('adds the amount, capped at max', () => {
    expect(applyRecovery(2, 10, 3)).toBe(5);
    expect(applyRecovery(8, 10, 5)).toBe(10);
  });
  it('never goes below zero', () => {
    expect(applyRecovery(2, 10, -5)).toBe(0);
  });
  it('zero amount is a no-op', () => {
    expect(applyRecovery(4, 10, 0)).toBe(4);
  });
});
