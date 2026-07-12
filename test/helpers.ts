import { vi } from 'vitest';
import type { NormalizedMessageConfig, NormalizedPlatformConfig } from '../src/config/types.js';

export const sampleMessage: NormalizedMessageConfig = {
  id: 'front-door-open',
  name: 'Front door open',
  deviceIds: ['salon'],
  exposeSwitch: true,
  autoResetMs: 1000,
  cooldownMs: 5000,
  priority: 'info',
  iconType: 'none',
  cycles: 1,
  frames: [{ text: 'Door {{name}} open', icon: 'a1234', order: 0 }],
  sound: {
    enabled: true,
    category: 'notifications',
    id: 'positive1',
    repeat: 1,
  },
  value: '',
};

export const sampleConfig: NormalizedPlatformConfig = {
  platform: 'LaMetricTime',
  name: 'LaMetric Time',
  debug: false,
  queueStrategy: 'sequential',
  maxQueueSize: 50,
  duplicateStrategy: 'drop',
  globalDelayMs: 0,
  testSwitch: false,
  devices: [
    {
      id: 'salon',
      name: 'LaMetric Salon',
      host: '192.168.1.50',
      protocol: 'http',
      port: 8080,
      apiKey: 'SECRET',
      timeoutMs: 5000,
      retryCount: 2,
      retryBackoffMs: 0,
    },
  ],
  messages: [sampleMessage],
};

export function response(status: number, body: unknown = { success: true }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createHomebridgeMocks() {
  const registered: unknown[] = [];
  const unregistered: unknown[] = [];
  const updated: unknown[] = [];
  const eventHandlers = new Map<string, () => void>();

  class PlatformAccessory {
    public context: Record<string, unknown> = {};
    private readonly services = new Map<string, FakeService>();
    public constructor(
      public displayName: string,
      public UUID: string,
    ) {}
    public getService(service: string): FakeService | undefined {
      return this.services.get(service);
    }
    public addService(service: string): FakeService {
      const fakeService = new FakeService();
      this.services.set(service, fakeService);
      return fakeService;
    }
  }

  class FakeCharacteristic {
    public onSetHandler: ((value: boolean) => Promise<void>) | undefined;
    public onGet(): this {
      return this;
    }
    public onSet(handler: (value: boolean) => Promise<void>): this {
      this.onSetHandler = handler;
      return this;
    }
  }

  class FakeService {
    public readonly characteristic = new FakeCharacteristic();
    public setCharacteristic(): this {
      return this;
    }
    public getCharacteristic(): FakeCharacteristic {
      return this.characteristic;
    }
    public updateCharacteristic = vi.fn();
  }

  const api = {
    hap: {
      Service: { Switch: 'Switch' },
      Characteristic: { Name: 'Name', On: 'On' },
      uuid: {
        generate: (value: string) => `uuid:${value}`,
      },
    },
    platformAccessory: PlatformAccessory,
    registerPlatformAccessories: vi.fn((_plugin: string, _platform: string, accessories: unknown[]) => registered.push(...accessories)),
    unregisterPlatformAccessories: vi.fn((_plugin: string, _platform: string, accessories: unknown[]) => unregistered.push(...accessories)),
    updatePlatformAccessories: vi.fn((accessories: unknown[]) => updated.push(...accessories)),
    on: vi.fn((event: string, handler: () => void) => eventHandlers.set(event, handler)),
  };

  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return { api, log, registered, unregistered, updated, eventHandlers, PlatformAccessory, FakeService };
}
