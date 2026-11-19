import type { PlatformAccessory } from 'homebridge';
import type { LaMetricClient } from '../lametric/client.js';
import { LaMetricError } from '../lametric/errors.js';
import type { LaMetricDisplaySettings } from '../lametric/types.js';
import type { LaMetricTimePlatform } from '../platform.js';

interface DisplaySwitchContext {
  displayBeforeOff?: Pick<LaMetricDisplaySettings, 'brightness' | 'brightness_mode'>;
  displayBeforeStandby?: LaMetricDisplaySettings;
  screensaverActive?: boolean;
}

export class DisplaySwitchAccessory {
  private requestedOn: boolean | undefined;
  private updating = false;

  public constructor(
    private readonly platform: LaMetricTimePlatform,
    private readonly accessory: PlatformAccessory<DisplaySwitchContext>,
    private readonly client: LaMetricClient,
  ) {
    const { Service, Characteristic } = this.platform.api.hap;
    const service = this.accessory.getService(Service.Switch) ?? this.accessory.addService(Service.Switch);
    service.setCharacteristic(Characteristic.Name, this.accessory.displayName);
    const on = service.getCharacteristic(Characteristic.On);
    on.onGet(() => this.isOn()).onSet((value) => {
      this.requestedOn = value === true;
      void this.applyRequests(() => on.updateValue(this.isOn()));
    });
  }

  private isOn(): boolean {
    const context = this.accessory.context;
    return !context.screensaverActive && !context.displayBeforeOff;
  }

  private async applyRequests(report: () => void): Promise<void> {
    if (this.updating) {
      return;
    }
    this.updating = true;
    try {
      while (this.requestedOn !== undefined) {
        const on = this.requestedOn;
        this.requestedOn = undefined;
        try {
          await this.setDisplayOn(on, report);
        } catch (error) {
          const reason = error instanceof LaMetricError ? error.message : 'Invalid or missing response from the LaMetric';
          const action = on ? (this.isOn() ? 'restore the saved display settings' : 'wake the display') : 'start the screensaver';
          this.platform.logger.warn('[%s] Could not %s: %s', this.accessory.displayName, action, reason);
        }
      }
    } finally {
      this.updating = false;
      report();
    }
  }

  private async setDisplayOn(on: boolean, report: () => void): Promise<void> {
    const context = this.accessory.context;
    if (on) {
      const screensaver = context.displayBeforeStandby?.screensaver;
      const brightness = context.displayBeforeOff ?? context.displayBeforeStandby;
      if (brightness) {
        if (screensaver) {
          await this.client.setDisplaySettings({ screensaver: { enabled: false } });
          delete context.screensaverActive;
          this.platform.api.updatePlatformAccessories([this.accessory]);
          report();
          await this.restoreScreensaverMode(screensaver);
        }
        await this.client.setDisplaySettings({
          brightness: brightness.brightness,
          brightness_mode: brightness.brightness_mode,
        });
        delete context.displayBeforeStandby;
        delete context.displayBeforeOff;
        delete context.screensaverActive;
        this.platform.api.updatePlatformAccessories([this.accessory]);
      }
    } else if (!context.screensaverActive) {
      if (!context.displayBeforeStandby) {
        context.displayBeforeStandby = await this.client.getDisplaySettings();
        this.platform.api.updatePlatformAccessories([this.accessory]);
      }

      // LaMetric schedules use UTC. Start in the past and leave a one-second gap each day.
      const start = Date.now() - 60_000;
      await this.client.setDisplaySettings({
        brightness_mode: 'auto',
        screensaver: {
          enabled: true,
          mode: 'time_based',
          mode_params: {
            enabled: true,
            start_time: new Date(start).toISOString().slice(11, 19),
            end_time: new Date(start - 1_000).toISOString().slice(11, 19),
          },
        },
      });
      context.screensaverActive = true;
      this.platform.api.updatePlatformAccessories([this.accessory]);
    }
  }

  private async restoreScreensaverMode(previous: LaMetricDisplaySettings['screensaver']): Promise<void> {
    const { start_time, end_time } = previous.mode_params;
    if (isTime(start_time) && isTime(end_time)) {
      // Saving the times selects time_based mode even if it was previously inactive.
      await this.client.setDisplaySettings({
        screensaver: { mode: 'time_based', mode_params: { start_time, end_time } },
      });
    }

    if (previous.whenDarkEnabled) {
      await this.client.setDisplaySettings({
        screensaver: { mode: 'when_dark', mode_params: { enabled: true } },
      });
    }
  }
}

function isTime(value: string | undefined): value is string {
  return typeof value === 'string' && /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u.test(value);
}
