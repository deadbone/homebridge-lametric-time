import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config/validation.js';

describe('normalizeConfig', () => {
  it('validates unique identifiers', () => {
    expect(() =>
      normalizeConfig({
        platform: 'LaMetricTime',
        name: 'LaMetric Time',
        devices: [
          { id: 'salon', name: 'One', host: '192.168.1.2', apiKey: 'SECRET' },
          { id: 'salon', name: 'Two', host: '192.168.1.3', apiKey: 'SECRET2' },
        ],
        messages: [],
      }),
    ).toThrow(/unique/u);
  });

  it('rejects references to unknown devices', () => {
    expect(() =>
      normalizeConfig({
        platform: 'LaMetricTime',
        name: 'LaMetric Time',
        devices: [{ id: 'salon', name: 'One', host: '192.168.1.2', apiKey: 'SECRET' }],
        messages: [{ id: 'm1', name: 'M1', deviceIds: ['missing'], frames: [{ text: 'Hello' }] }],
      }),
    ).toThrow(/unknown device/u);
  });
});
