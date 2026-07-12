import type { PlatformAccessory } from 'homebridge';
import type { NormalizedMessageConfig } from '../config/types.js';
import type { LaMetricTimePlatform } from '../platform.js';
import { NotificationSwitchAccessory } from './notification-switch.js';

export class MessageAccessory extends NotificationSwitchAccessory {
  public constructor(
    platform: LaMetricTimePlatform,
    accessory: PlatformAccessory,
    message: NormalizedMessageConfig | undefined,
    testSwitch: boolean,
  ) {
    super(platform, accessory, message, testSwitch);
  }
}
