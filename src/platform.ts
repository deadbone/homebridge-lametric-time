import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { ConfigValidationError, normalizeConfig } from './config/validation.js';
import type { NormalizedDeviceConfig, NormalizedMessageConfig, NormalizedPlatformConfig } from './config/types.js';
import { LaMetricClient } from './lametric/client.js';
import { NotificationBuilder } from './lametric/notification-builder.js';
import { MessageAccessory } from './accessories/message-accessory.js';
import { QueueManager } from './services/queue.js';
import { RateLimiter } from './services/rate-limiter.js';
import { PluginLogger } from './utils/logger.js';
import { sanitizeHomeKitName } from './utils/security.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

export interface MessageDispatchResult {
  readonly queued: number;
  readonly targets: number;
}

export class LaMetricTimePlatform implements DynamicPlatformPlugin {
  public readonly accessories = new Map<string, PlatformAccessory>();
  public readonly logger: PluginLogger;
  public readonly configData: NormalizedPlatformConfig;
  private readonly clients = new Map<string, LaMetricClient>();
  private readonly queueManager = new QueueManager();
  private readonly rateLimiters = new Map<string, RateLimiter>();
  private readonly builder = new NotificationBuilder();

  public constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    try {
      this.configData = normalizeConfig(config);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        log.error(error.message);
      }
      throw error;
    }
    this.logger = new PluginLogger(log, this.configData.debug);

    for (const device of this.configData.devices) {
      this.clients.set(device.id, new LaMetricClient(device));
      this.rateLimiters.set(device.id, new RateLimiter(this.configData.globalDelayMs));
    }

    this.api.on('didFinishLaunching', () => {
      this.registerConfiguredAccessories();
    });
    this.api.on('shutdown', () => {
      this.queueManager.stopAll();
    });
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.logger.info('Loading accessory from cache: %s', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  public async dispatchMessage(message: NormalizedMessageConfig): Promise<MessageDispatchResult> {
    const payload = this.builder.build(message, { name: message.name, value: message.value });
    let queued = 0;

    for (const deviceId of message.deviceIds) {
      const device = this.getDevice(deviceId);
      const client = this.clients.get(deviceId);
      const limiter = this.rateLimiters.get(deviceId);
      if (!device || !client || !limiter) {
        this.logger.warn('[%s] Ignoring unknown LaMetric device %s', message.name, deviceId);
        continue;
      }

      const queue = this.queueManager.getQueue(device.id, {
        maxSize: this.configData.maxQueueSize,
        duplicateStrategy: this.configData.duplicateStrategy,
      });
      const accepted = queue.enqueue({
        key: message.id,
        label: message.name,
        payload,
        cooldownMs: message.cooldownMs,
        run: async () => {
          try {
            await limiter.wait();
            await client.sendNotification(payload);
            this.logger.info('[%s] Notification sent to %s', message.name, device.name);
            return true;
          } catch (error) {
            this.logger.warn('[%s] Notification failed for %s: %s', message.name, device.name, error instanceof Error ? error.message : String(error));
            return false;
          }
        },
      });
      if (accepted) {
        queued += 1;
      }
    }

    if (queued > 0) {
      this.logger.info('[%s] Notification added to queue', message.name);
    }
    return { queued, targets: message.deviceIds.length };
  }

  public async dispatchTestNotification(): Promise<MessageDispatchResult> {
    const firstDevice = this.configData.devices[0];
    if (!firstDevice) {
      this.logger.warn('[LaMetric Test] No device configured');
      return { queued: 0, targets: 0 };
    }
    const message: NormalizedMessageConfig = {
      id: 'global-test',
      name: 'LaMetric Test',
      deviceIds: [firstDevice.id],
      exposeSwitch: true,
      autoResetMs: 1000,
      cooldownMs: 0,
      priority: 'critical',
      iconType: 'alert',
      cycles: 1,
      frames: [{ text: 'Homebridge test', icon: '', order: 0 }],
      value: '',
    };
    return this.dispatchMessage(message);
  }

  private registerConfiguredAccessories(): void {
    const expectedUUIDs = new Set<string>();

    for (const message of this.configData.messages.filter((item) => item.exposeSwitch)) {
      const uuid = this.messageUuid(message.id);
      expectedUUIDs.add(uuid);
      this.registerOrRestoreAccessory(uuid, sanitizeHomeKitName(message.name), message, false);
    }

    if (this.configData.testSwitch) {
      const uuid = this.messageUuid('global-test');
      expectedUUIDs.add(uuid);
      this.registerOrRestoreAccessory(uuid, 'LaMetric Test', undefined, true);
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!expectedUUIDs.has(uuid)) {
        this.logger.info('Removing stale accessory from cache: %s', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }
  }

  private registerOrRestoreAccessory(
    uuid: string,
    displayName: string,
    message: NormalizedMessageConfig | undefined,
    testSwitch: boolean,
  ): void {
    const existingAccessory = this.accessories.get(uuid);
    if (existingAccessory) {
      existingAccessory.displayName = displayName;
      existingAccessory.context.messageId = message?.id ?? 'global-test';
      existingAccessory.context.testSwitch = testSwitch;
      this.api.updatePlatformAccessories([existingAccessory]);
      new MessageAccessory(this, existingAccessory, message, testSwitch);
      return;
    }

    const accessory = new this.api.platformAccessory(displayName, uuid);
    accessory.context.messageId = message?.id ?? 'global-test';
    accessory.context.testSwitch = testSwitch;
    new MessageAccessory(this, accessory, message, testSwitch);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.accessories.set(uuid, accessory);
  }

  private getDevice(deviceId: string): NormalizedDeviceConfig | undefined {
    return this.configData.devices.find((device) => device.id === deviceId);
  }

  private messageUuid(messageId: string): string {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:${messageId}`);
  }
}
