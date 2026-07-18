import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config/validation.js';

describe('normalizeConfig', () => {
  const validConfig = {
    platform: 'LaMetricTime',
    name: 'LaMetric Time',
    devices: [{ id: 'salon', name: 'One', host: '192.168.1.2', apiKey: 'SECRET' }],
    messages: [{ id: 'm1', name: 'M1', deviceIds: ['salon'], frames: [{ text: 'Hello' }] }],
  };

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

  it('rejects invalid debug values', () => {
    expect(() => normalizeConfig({ ...validConfig, debug: 'true' })).toThrow(/debug must be a boolean/u);
  });

  it('rejects invalid testSwitch values', () => {
    expect(() => normalizeConfig({ ...validConfig, testSwitch: 'false' })).toThrow(/testSwitch must be a boolean/u);
  });

  it('normalizes per-device connection test switches', () => {
    const normalized = normalizeConfig({
      ...validConfig,
      devices: [{ id: 'salon', name: 'One', host: '192.168.1.2', apiKey: 'SECRET', connectionTestSwitch: true }],
    });
    expect(normalized.devices[0]?.connectionTestSwitch).toBe(true);
  });

  it('rejects invalid per-device connection test switch values', () => {
    expect(() =>
      normalizeConfig({
        ...validConfig,
        devices: [{ id: 'salon', name: 'One', host: '192.168.1.2', apiKey: 'SECRET', connectionTestSwitch: 'true' }],
      }),
    ).toThrow(/devices\[0\]\.connectionTestSwitch must be a boolean/u);
  });

  it('rejects invalid duplicateStrategy values', () => {
    expect(() => normalizeConfig({ ...validConfig, duplicateStrategy: 'merge' })).toThrow(/duplicateStrategy must be enqueue, drop, or replace/u);
  });

  it('rejects invalid queueStrategy values', () => {
    expect(() => normalizeConfig({ ...validConfig, queueStrategy: 'parallel' })).toThrow(/queueStrategy must be sequential/u);
  });

  it('rejects invalid top-level queue bounds', () => {
    expect(() => normalizeConfig({ ...validConfig, maxQueueSize: 0 })).toThrow(/maxQueueSize must be an integer between 1 and 500/u);
    expect(() => normalizeConfig({ ...validConfig, globalDelayMs: -1 })).toThrow(/globalDelayMs must be an integer between 0 and 60000/u);
  });
});
