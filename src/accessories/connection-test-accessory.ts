import type { PlatformAccessory } from 'homebridge';
import type { LaMetricTimePlatform } from '../platform.js';
import { NotificationSwitchAccessory } from './notification-switch.js';

export class ConnectionTestAccessory extends NotificationSwitchAccessory {
  public constructor(
    platform: LaMetricTimePlatform,
    accessory: PlatformAccessory,
    deviceId: string,
  ) {
    super(platform, accessory, { deviceTestId: deviceId, autoResetMs: 1000 });
  }
}
