import type { NormalizedSilentHoursConfig, SilentHoursMode } from '../config/types.js';

export type SilentHoursPolicy = 'none' | SilentHoursMode;

export class SilentHours {
  public constructor(private readonly ranges: readonly NormalizedSilentHoursConfig[]) {}

  public currentPolicy(now = new Date()): SilentHoursPolicy {
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    let muted = false;

    for (const range of this.ranges) {
      if (!range.enabled || !isActiveRange(range.startMinutes, range.endMinutes, minuteOfDay)) {
        continue;
      }
      if (range.mode === 'criticalOnly') {
        return 'criticalOnly';
      }
      muted = true;
    }

    return muted ? 'mute' : 'none';
  }
}

function isActiveRange(start: number, end: number, minuteOfDay: number): boolean {
  if (start < end) {
    return minuteOfDay >= start && minuteOfDay < end;
  }
  return minuteOfDay >= start || minuteOfDay < end;
}
