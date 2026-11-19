export type NotificationPriority = 'info' | 'warning' | 'critical';
export type IconType = 'none' | 'info' | 'alert';
export type SoundCategory = 'notifications' | 'alarms';

export interface LaMetricFrame {
  readonly text: string;
  readonly icon?: string;
}

export interface LaMetricSound {
  readonly category: SoundCategory;
  readonly id: string;
  readonly repeat?: number;
}

export interface LaMetricNotificationModel {
  readonly cycles?: number;
  readonly frames: readonly LaMetricFrame[];
  readonly sound?: LaMetricSound;
}

export interface LaMetricNotificationPayload {
  readonly priority: NotificationPriority;
  readonly icon_type?: IconType;
  readonly model: LaMetricNotificationModel;
}

export interface LaMetricNotificationResponse {
  readonly id?: string;
  readonly success?: boolean;
}

export interface LaMetricScreensaverSettings {
  readonly enabled: boolean;
  readonly mode_params: {
    readonly enabled: boolean;
    readonly start_time?: string;
    readonly end_time?: string;
  };
}

export interface LaMetricDisplayUpdate {
  readonly brightness_mode?: 'auto' | 'manual';
  readonly brightness?: number;
  readonly screensaver?:
    | { readonly enabled: boolean; readonly mode?: never; readonly mode_params?: never }
    | {
      readonly enabled?: boolean;
      readonly mode: 'time_based' | 'when_dark';
      readonly mode_params: Partial<LaMetricScreensaverSettings['mode_params']>;
    };
}

export interface LaMetricDisplaySettings {
  readonly brightness: number;
  readonly brightness_mode: 'auto' | 'manual';
  readonly screensaver: LaMetricScreensaverSettings & { readonly whenDarkEnabled?: boolean };
}

export interface LaMetricDisplayState {
  readonly on?: boolean;
  readonly brightness?: number;
  readonly brightness_mode?: string;
  readonly screensaver?: {
    readonly enabled?: boolean;
    readonly modes?: {
      readonly time_based?: LaMetricScreensaverSettings['mode_params'];
      readonly when_dark?: { readonly enabled?: boolean };
    };
  };
}
