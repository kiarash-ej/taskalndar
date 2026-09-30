import { describe, expect, it } from 'vitest';
import {
  taskCompletionPercent,
  goalProgressPercent,
  combinedProgressScore,
  monthlyChangePercent,
} from '../src/progress';

describe('taskCompletionPercent', () => {
  it('is 0 when nothing was expected', () => {
    expect(taskCompletionPercent(0, 0)).toBe(0);
  });

  it('computes done/expected as a percentage', () => {
    expect(taskCompletionPercent(4, 2)).toBe(50);
  });

  it('never exceeds 100', () => {
    expect(taskCompletionPercent(2, 5)).toBe(100);
  });
});

describe('goalProgressPercent', () => {
  it('caps at 100 even when overshot', () => {
    expect(goalProgressPercent(120, 100)).toBe(100);
  });

  it('is 0 for a non-positive target', () => {
    expect(goalProgressPercent(10, 0)).toBe(0);
  });
});

describe('combinedProgressScore', () => {
  it('falls back to task completion alone with no goals', () => {
    expect(combinedProgressScore(80, [])).toBe(80);
  });

  it('averages task completion with the mean of goal percentages', () => {
    // task 60%, goals [100%, 50%] -> goal avg 75% -> combined (60+75)/2 = 67.5
    expect(combinedProgressScore(60, [100, 50])).toBe(67.5);
  });
});

describe('monthlyChangePercent', () => {
  it('reports a fresh start when the previous month scored 0', () => {
    expect(monthlyChangePercent(40, 0)).toEqual({ kind: 'fresh-start' });
  });

  it('computes signed percent change otherwise', () => {
    expect(monthlyChangePercent(60, 40)).toEqual({ kind: 'change', percent: 50 });
    expect(monthlyChangePercent(20, 40)).toEqual({ kind: 'change', percent: -50 });
  });
});
