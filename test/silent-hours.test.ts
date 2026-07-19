import { describe, expect, it } from 'vitest';
import { SilentHours } from '../src/services/silent-hours.js';
import type { NormalizedSilentHoursConfig } from '../src/config/types.js';

describe('SilentHours', () => {
  it('returns none outside configured ranges', () => {
    const silentHours = new SilentHours([range('22:00', '07:00', 'criticalOnly')]);
    expect(silentHours.currentPolicy(at('2026-07-19T12:00:00'))).toBe('none');
  });

  it('matches ranges crossing midnight', () => {
    const silentHours = new SilentHours([range('22:00', '07:00', 'criticalOnly')]);
    expect(silentHours.currentPolicy(at('2026-07-19T23:30:00'))).toBe('criticalOnly');
    expect(silentHours.currentPolicy(at('2026-07-20T06:59:00'))).toBe('criticalOnly');
    expect(silentHours.currentPolicy(at('2026-07-20T07:00:00'))).toBe('none');
  });

  it('prioritizes critical-only over mute for overlapping ranges', () => {
    const silentHours = new SilentHours([
      range('20:00', '23:00', 'mute'),
      range('22:00', '07:00', 'criticalOnly'),
    ]);
    expect(silentHours.currentPolicy(at('2026-07-19T22:30:00'))).toBe('criticalOnly');
  });

  it('ignores disabled ranges', () => {
    const silentHours = new SilentHours([range('00:00', '23:59', 'mute', false)]);
    expect(silentHours.currentPolicy(at('2026-07-19T12:00:00'))).toBe('none');
  });
});

function range(start: string, end: string, mode: 'criticalOnly' | 'mute', enabled = true): NormalizedSilentHoursConfig {
  return {
    enabled,
    start,
    end,
    mode,
    startMinutes: toMinutes(start),
    endMinutes: toMinutes(end),
  };
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function at(value: string): Date {
  return new Date(value);
}
