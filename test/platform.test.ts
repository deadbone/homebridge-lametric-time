import { describe, expect, it, vi } from 'vitest';
import { LaMetricTimePlatform } from '../src/platform.js';
import { createHomebridgeMocks } from './helpers.js';

describe('LaMetricTimePlatform accessories', () => {
  it('restores cached accessories without duplicating them', () => {
    const mocks = createHomebridgeMocks();
    const platform = new LaMetricTimePlatform(mocks.log as never, config() as never, mocks.api as never);
    const cached = new mocks.PlatformAccessory('Old Name', 'uuid:homebridge-lametric-time-messenger:front-door-open');
    platform.configureAccessory(cached as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();
    expect(mocks.api.registerPlatformAccessories).not.toHaveBeenCalled();
    expect(mocks.api.updatePlatformAccessories).toHaveBeenCalledTimes(1);
  });

  it('removes stale cached accessories', () => {
    const mocks = createHomebridgeMocks();
    const platform = new LaMetricTimePlatform(mocks.log as never, config({ messages: [] }) as never, mocks.api as never);
    const cached = new mocks.PlatformAccessory('Removed', 'uuid:homebridge-lametric-time-messenger:removed');
    platform.configureAccessory(cached as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();
    expect(mocks.unregistered).toHaveLength(1);
  });

  it('auto resets the switch to off', async () => {
    vi.useFakeTimers();
    const mocks = createHomebridgeMocks();
    new LaMetricTimePlatform(mocks.log as never, config() as never, mocks.api as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();
    const accessory = mocks.registered[0] as InstanceType<typeof mocks.PlatformAccessory>;
    const service = accessory.getService('Switch');
    await service?.characteristic.onSetHandler?.(true);
    vi.advanceTimersByTime(1000);
    expect(service?.updateCharacteristic).toHaveBeenCalledWith('On', false);
    vi.useRealTimers();
  });

  it('registers per-device connection test switches', async () => {
    const mocks = createHomebridgeMocks();
    const platform = new LaMetricTimePlatform(
      mocks.log as never,
      config({ devices: [{ id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', retryCount: 0, connectionTestSwitch: true }] }) as never,
      mocks.api as never,
    );
    platform.dispatchDeviceConnectionTest = vi.fn(async () => ({ queued: 1, targets: 1 }));

    mocks.eventHandlers.get('didFinishLaunching')?.();

    const accessory = mocks.registered[1] as InstanceType<typeof mocks.PlatformAccessory>;
    expect(accessory.displayName).toBe('Test LaMetric Salon');
    expect(accessory.context.connectionTestSwitch).toBe(true);
    await accessory.getService('Switch')?.characteristic.onSetHandler?.(true);
    expect(platform.dispatchDeviceConnectionTest).toHaveBeenCalledWith('salon');
  });

  it('skips non-critical messages during critical-only silent hours', async () => {
    const mocks = createHomebridgeMocks();
    const platform = new LaMetricTimePlatform(
      mocks.log as never,
      config({ silentHours: [{ start: '00:00', end: '23:59', mode: 'criticalOnly' }] }) as never,
      mocks.api as never,
    );

    const message = platform.configData.messages[0];
    expect(message).toBeDefined();

    const result = await platform.dispatchMessage(message as NonNullable<typeof message>);

    expect(result).toEqual({ queued: 0, targets: 1 });
    expect(mocks.log.info).toHaveBeenCalledWith(
      '[%s] Notification skipped by silent hours because priority is %s',
      'Front Door Open',
      'info',
    );
  });
});

function config(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'LaMetricTime',
    name: 'LaMetric Time',
    devices: [{ id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', retryCount: 0 }],
    messages: [
      {
        id: 'front-door-open',
        name: 'Front Door Open',
        deviceIds: ['salon'],
        exposeSwitch: true,
        autoResetMs: 1000,
        frames: [{ text: 'Door open' }],
      },
    ],
    ...overrides,
  };
}
