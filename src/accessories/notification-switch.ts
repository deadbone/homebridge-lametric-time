import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { NormalizedMessageConfig } from '../config/types.js';
import type { LaMetricTimePlatform } from '../platform.js';

export class NotificationSwitchAccessory {
  private readonly service: Service;
  private resetTimer: NodeJS.Timeout | undefined;

  public constructor(
    private readonly platform: LaMetricTimePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly message: NormalizedMessageConfig | undefined,
    private readonly testSwitch: boolean,
  ) {
    const { Service: HapService, Characteristic } = this.platform.api.hap;
    this.service = this.accessory.getService(HapService.Switch) ?? this.accessory.addService(HapService.Switch);
    this.service.setCharacteristic(Characteristic.Name, this.accessory.displayName);
    this.service
      .getCharacteristic(Characteristic.On)
      .onGet(() => false)
      .onSet(async (value: CharacteristicValue) => {
        if (value !== true) {
          return;
        }
        if (this.testSwitch) {
          await this.platform.dispatchTestNotification();
        } else if (this.message) {
          await this.platform.dispatchMessage(this.message);
        }
        this.scheduleAutoReset();
      });
  }

  private scheduleAutoReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    const delay = this.message?.autoResetMs ?? 1000;
    this.resetTimer = setTimeout(() => {
      this.service.updateCharacteristic(this.platform.api.hap.Characteristic.On, false);
      this.resetTimer = undefined;
    }, delay);
  }
}
