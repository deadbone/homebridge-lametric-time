import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaMetricTimePlatform } from '../src/platform.js';
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

  const originalMode = { enabled: false, start_time: '19:00:00', end_time: '06:00:00' };
  const initialDisplay = {
    brightness: 47,
    brightness_mode: 'manual',
    screensaver: { enabled: true, modes: { when_dark: { enabled: true }, time_based: originalMode } },
  };
  const displayConfig = config({
    devices: [
      { id: 'salon', name: 'LaMetric Salon', host: '192.168.1.50', apiKey: 'SECRET', displaySwitch: true },
      { id: 'bureau', name: 'LaMetric Bureau', host: '192.168.1.51', apiKey: 'SECRET' },
    ],
    messages: [],
  });

  it('starts the built-in screensaver and restores the settings after a restart without polling', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { display: initialDisplay }))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchImpl);
    const mocks = createHomebridgeMocks();
    new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    expect(mocks.registered).toHaveLength(1);
    const accessory = mocks.registered[0] as InstanceType<typeof mocks.PlatformAccessory>;
    expect(accessory.displayName).toBe('Display LaMetric Salon');
    const characteristic = accessory.getService('Switch')?.characteristic;
    expect(characteristic?.onGetHandler?.()).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(characteristic?.onSetHandler?.(false)).toBeUndefined();
    characteristic?.onSetHandler?.(false);
    await vi.waitFor(() => expect(characteristic?.updateValue).toHaveBeenCalledWith(false));
    expect(characteristic?.onGetHandler?.()).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://192.168.1.50:8080/api/v2/device?fields=display');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('http://192.168.1.50:8080/api/v2/device/display');
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({
      brightness_mode: 'auto',
      screensaver: {
        enabled: true,
        mode: 'time_based',
        mode_params: { enabled: true, start_time: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/u) },
      },
    });
    expect(mocks.api.updatePlatformAccessories).toHaveBeenCalledWith([accessory]);

    const restarted = createHomebridgeMocks();
    const cached = new restarted.PlatformAccessory(accessory.displayName, accessory.UUID);
    cached.context = structuredClone(accessory.context);
    const platform = new LaMetricTimePlatform(restarted.log as never, displayConfig as never, restarted.api as never);
    platform.configureAccessory(cached as never);
    restarted.eventHandlers.get('didFinishLaunching')?.();
    expect(restarted.registered).toHaveLength(0);

    const restored = cached.getService('Switch')?.characteristic;
    expect(restored?.onGetHandler?.()).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    restored?.onSetHandler?.(true);
    await vi.waitFor(() => expect(restored?.updateValue).toHaveBeenCalledWith(true));
    expect(restored?.onGetHandler?.()).toBe(true);
    expect(cached.context.displayBeforeStandby).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({
      screensaver: { enabled: true, mode: 'time_based', mode_params: originalMode },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({
      screensaver: { enabled: true, mode: 'when_dark', mode_params: { enabled: true } },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[4]?.[1]?.body))).toEqual({ brightness: 47, brightness_mode: 'manual' });
  });

  it.each([
    {
      name: 'an active darkness mode with no schedule',
      previous: { enabled: true, mode_params: { enabled: false }, whenDarkEnabled: true },
      restored: { enabled: true, mode: 'when_dark', mode_params: { enabled: true } },
    },
    {
      name: 'a disabled screensaver with incomplete times',
      previous: { enabled: false, mode_params: { enabled: false, end_time: '06:00:00' }, whenDarkEnabled: false },
      restored: { enabled: false },
    },
  ])('wakes a device with $name saved by 0.1.13', async ({ previous, restored }) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { success: { data: { screensaver: { enabled: restored.enabled } } } }))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchImpl);
    const mocks = createHomebridgeMocks();
    const cached = new mocks.PlatformAccessory('Display LaMetric Salon', 'uuid:homebridge-lametric-time-messenger:display:salon');
    cached.context.screensaverActive = true;
    cached.context.displayBeforeStandby = { brightness: 40, brightness_mode: 'manual', screensaver: previous };
    const platform = new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    platform.configureAccessory(cached as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    const characteristic = cached.getService('Switch')?.characteristic;
    expect(characteristic?.onGetHandler?.()).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    characteristic?.onSetHandler?.(true);
    await vi.waitFor(() => expect(characteristic?.updateValue).toHaveBeenCalledWith(true));
    expect(fetchImpl.mock.calls.map(([, options]) => [options?.method, JSON.parse(String(options?.body))])).toEqual([
      ['PUT', { screensaver: restored }],
      ['PUT', { brightness: 40, brightness_mode: 'manual' }],
    ]);
    expect(cached.context.displayBeforeStandby).toBeUndefined();
  });

  it('keeps HomeKit responsive when display calls time out and logs the failed command once', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
      .mockResolvedValueOnce(response(200, initialDisplay))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchImpl);
    const mocks = createHomebridgeMocks();
    new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    const accessory = mocks.registered[0] as InstanceType<typeof mocks.PlatformAccessory>;
    const characteristic = accessory.getService('Switch')?.characteristic;
    expect(characteristic?.onSetHandler?.(false)).toBeUndefined();
    expect(characteristic?.onGetHandler?.()).toBe(true);
    await vi.waitFor(() => expect(characteristic?.updateValue).toHaveBeenCalledWith(true));
    expect(mocks.log.warn).toHaveBeenCalledExactlyOnceWith(
      '[%s] Could not %s: %s', 'Display LaMetric Salon', 'start the screensaver', expect.stringContaining('PUT display'),
    );
    expect(fetchImpl.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['http://192.168.1.50:8080/api/v2/device?fields=display', 'GET'],
      ['http://192.168.1.50:8080/api/v2/device/display', 'GET'],
      ['http://192.168.1.50:8080/api/v2/device/display', 'PUT'],
    ]);
    expect(accessory.context.displayBeforeStandby).toBeDefined();
  });

  it('restores a manual brightness saved by 0.1.12 without a read', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchImpl);
    const mocks = createHomebridgeMocks();
    const cached = new mocks.PlatformAccessory('Display LaMetric Salon', 'uuid:homebridge-lametric-time-messenger:display:salon');
    cached.context.displayBeforeOff = { brightness: 30, brightness_mode: 'manual' };
    const platform = new LaMetricTimePlatform(mocks.log as never, displayConfig as never, mocks.api as never);
    platform.configureAccessory(cached as never);
    mocks.eventHandlers.get('didFinishLaunching')?.();

    const characteristic = cached.getService('Switch')?.characteristic;
    expect(characteristic?.onGetHandler?.()).toBe(false);
    characteristic?.onSetHandler?.(true);
    await vi.waitFor(() => expect(characteristic?.updateValue).toHaveBeenCalledWith(true));
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      'http://192.168.1.50:8080/api/v2/device/display',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ brightness: 30, brightness_mode: 'manual' }) }),
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
