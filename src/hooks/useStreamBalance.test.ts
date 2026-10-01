// src/hooks/useStreamBalance.test.ts
import { describe, it, expect } from 'vitest';
import { formatStroopsToXlm } from './useStreamBalance';

describe('useStreamBalance Helpers', () => {
  it('formats stroops to XLM with proper precision', () => {
    // 10 XLM = 100,000,000 stroops
    expect(formatStroopsToXlm(100_000_000n)).toBe('10.0000');
    // 0.5 XLM = 5,000,000 stroops
    expect(formatStroopsToXlm(5_000_000n)).toBe('0.5000');
    // 1 stroop = 0.0000001 XLM (7 decimals)
    expect(formatStroopsToXlm(1n, 7)).toBe('0.0000001');
    // 0 stroops
    expect(formatStroopsToXlm(0n)).toBe('0.0000');
  });
});
