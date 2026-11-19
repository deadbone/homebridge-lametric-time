import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaMetricTimePlatform } from '../src/platform.js';
import type { LaMetricDisplaySettings } from '../src/lametric/types.js';
import { createHomebridgeMocks, response } from './helpers.js';

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
      config({ devices: [{ id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', retryCount: 0, silentHours: [{ start: '00:00', end: '23:59', mode: 'criticalOnly' }] }] }) as never,
      mocks.api as never,
    );

    const message = platform.configData.messages[0];
    expect(message).toBeDefined();

    const result = await platform.dispatchMessage(message as NonNullable<typeof message>);

    expect(result).toEqual({ queued: 0, targets: 1 });
    expect(mocks.log.info).toHaveBeenCalledWith(
      '[%s] Notification skipped for %s by silent hours because priority is %s',
      'Front Door Open',
      'LaMetric Salon',
      'info',
    );
  });

  it('applies silent hours only to the targeted device', async () => {
    const mocks = createHomebridgeMocks();
    const platform = new LaMetricTimePlatform(
      mocks.log as never,
      config({
        devices: [
          { id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', retryCount: 0, silentHours: [{ start: '00:00', end: '23:59', mode: 'criticalOnly' }] },
          { id: 'bureau', name: 'LaMetric Bureau', host: '192.168.1.51', apiKey: 'SECRET', retryCount: 0 },
        ],
        messages: [{ id: 'front-door-open', name: 'Front Door Open', deviceIds: ['salon', 'bureau'], exposeSwitch: true, autoResetMs: 1000, frames: [{ text: 'Door open' }] }],
      }) as never,
      mocks.api as never,
    );

    const message = platform.configData.messages[0];
    expect(message).toBeDefined();

    const result = await platform.dispatchMessage(message as NonNullable<typeof message>);

    expect(result).toEqual({ queued: 1, targets: 2 });
    expect(mocks.log.info).toHaveBeenCalledWith(
      '[%s] Notification skipped for %s by silent hours because priority is %s',
      'Front Door Open',
      'LaMetric Salon',
      'info',
    );
  });
});

describe('LaMetricTimePlatform display switches', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('controls the selected device and restores its automatic brightness after a restart', async () => {
    const settingsBeforeOff: LaMetricDisplaySettings = { brightness: 47, brightness_mode: 'auto' };
    let settings = settingsBeforeOff;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, options) => {
      if (options?.method === 'PUT') {
        settings = JSON.parse(String(options.body)) as LaMetricDisplaySettings;
        return response(200, { success: { data: settings, path: '/api/v2/device/display' } });
      }
      return response(200, settings);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const displayConfig = config({
      devices: [
        { id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', displaySwitch: true },
        { id: 'bureau', name: 'LaMetric Bureau', host: '192.168.1.51', apiKey: 'SECRET' },
      ],
      messages: [],
    });
    const mocks = createHomebridgeMocks();
    new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    expect(mocks.registered).toHaveLength(1);
    const accessory = mocks.registered[0] as InstanceType<typeof mocks.PlatformAccessory>;
    expect(accessory.displayName).toBe('Display LaMetric Salon');
    const characteristic = accessory.getService('Switch')?.characteristic;
    expect(await characteristic?.onGetHandler?.()).toBe(true);
    await Promise.all([characteristic?.onSetHandler?.(false), characteristic?.onSetHandler?.(false)]);
    expect(settings).toEqual({ brightness: 0, brightness_mode: 'manual' });
    expect(await characteristic?.onGetHandler?.()).toBe(false);
    expect(fetchImpl.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(accessory.context.displayBeforeOff).toEqual(settingsBeforeOff);
    expect(mocks.api.updatePlatformAccessories).toHaveBeenCalledWith([accessory]);

    const restarted = createHomebridgeMocks();
    const cached = new restarted.PlatformAccessory(accessory.displayName, accessory.UUID);
    cached.context = structuredClone(accessory.context);
    const platform = new LaMetricTimePlatform(restarted.log as never, displayConfig as never, restarted.api as never);
    platform.configureAccessory(cached as never);
    restarted.eventHandlers.get('didFinishLaunching')?.();
    expect(restarted.registered).toHaveLength(0);

    const restored = cached.getService('Switch')?.characteristic;
    expect(await restored?.onGetHandler?.()).toBe(false);
    await restored?.onSetHandler?.(true);
    expect(settings).toEqual(settingsBeforeOff);
    expect(await restored?.onGetHandler?.()).toBe(true);
    expect(cached.context.displayBeforeOff).toBeUndefined();
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(
      Array.from({ length: fetchImpl.mock.calls.length }, () => 'http://192.168.1.50:8080/api/v2/device/display'),
    );
  });

  it('retains the manual brightness when the device applies the write before it times out', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { brightness: 30, brightness_mode: 'manual' }))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(response(200, { brightness: 0, brightness_mode: 'manual' }))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchImpl);
    const mocks = createHomebridgeMocks();
    const displayConfig = config({
      devices: [{ id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', retryCount: 0, displaySwitch: true }],
      messages: [],
    });
    new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    const accessory = mocks.registered[0] as InstanceType<typeof mocks.PlatformAccessory>;
    const characteristic = accessory.getService('Switch')?.characteristic;
    await expect(characteristic?.onSetHandler?.(false)).rejects.toThrow(/timed out/iu);
    await characteristic?.onSetHandler?.(true);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'http://192.168.1.50:8080/api/v2/device/display',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ brightness: 30, brightness_mode: 'manual' }) }),
    );
    expect(accessory.context.displayBeforeOff).toBeUndefined();
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
