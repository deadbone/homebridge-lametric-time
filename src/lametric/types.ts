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
