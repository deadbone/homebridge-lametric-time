import type { API, PlatformAccessory } from 'homebridge';
import type { LaMetricClient } from '../lametric/client.js';
import type { LaMetricDisplaySettings } from '../lametric/types.js';

interface DisplaySwitchContext {
  displayBeforeOff?: LaMetricDisplaySettings;
}

export class DisplaySwitchAccessory {
  private lastWrite = Promise.resolve();

  public constructor(
    private readonly api: API,
    private readonly accessory: PlatformAccessory<DisplaySwitchContext>,
    private readonly client: LaMetricClient,
  ) {
    const { Service, Characteristic } = this.api.hap;
    const service = this.accessory.getService(Service.Switch) ?? this.accessory.addService(Service.Switch);
    service.setCharacteristic(Characteristic.Name, this.accessory.displayName);
    service.getCharacteristic(Characteristic.On)
      .onGet(async () => {
        await this.lastWrite;
        return isDisplayOn(await this.client.getDisplaySettings());
      })
      .onSet((value) => {
        const write = this.lastWrite.then(() => this.setDisplayOn(value === true));
        this.lastWrite = write.catch(() => undefined);
        return write;
      });
  }

  private async setDisplayOn(on: boolean): Promise<void> {
    const settings = await this.client.getDisplaySettings();
    const context = this.accessory.context;

    if (on) {
      if (context.displayBeforeOff) {
        await this.client.setDisplaySettings(context.displayBeforeOff);
        delete context.displayBeforeOff;
        this.api.updatePlatformAccessories([this.accessory]);
      } else if (!isDisplayOn(settings)) {
        await this.client.setDisplaySettings({ brightness_mode: 'auto' });
      }
    } else if (isDisplayOn(settings)) {
      // Save before sending the request in case the device applies it before a timeout or restart.
      context.displayBeforeOff = settings;
      this.api.updatePlatformAccessories([this.accessory]);
      await this.client.setDisplaySettings({ brightness_mode: 'manual', brightness: 0 });
    }
  }
}

function isDisplayOn(settings: LaMetricDisplaySettings): boolean {
  return settings.brightness_mode === 'auto' || settings.brightness > 0;
}
