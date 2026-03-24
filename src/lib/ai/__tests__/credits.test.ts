import { describe, it, expect } from 'vitest';
import { CREDIT_COSTS, type AIRouteKey } from '../credits';

describe('CREDIT_COSTS', () => {
  it('should define a positive cost for generate-solution', () => {
    expect(CREDIT_COSTS['generate-solution']).toBeGreaterThan(0);
  });

  it('should have only known route keys', () => {
    const keys = Object.keys(CREDIT_COSTS);
    expect(keys).toContain('generate-solution');
    // All costs should be positive integers
    for (const key of keys) {
      const cost = CREDIT_COSTS[key as AIRouteKey];
      expect(cost).toBeGreaterThan(0);
      expect(Number.isInteger(cost)).toBe(true);
    }
  });
});

describe('deductCredits', () => {
  it('should be exported as a function', async () => {
    const mod = await import('../credits');
    expect(typeof mod.deductCredits).toBe('function');
  });
});

describe('checkAndDeductCredits', () => {
  it('should be exported as a function', async () => {
    const mod = await import('../credits');
    expect(typeof mod.checkAndDeductCredits).toBe('function');
  });
});
