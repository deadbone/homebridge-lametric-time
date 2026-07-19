import type { IconType, NotificationPriority, SoundCategory } from '../lametric/types.js';

export type QueueDuplicateStrategy = 'enqueue' | 'drop' | 'replace';
export type SilentHoursMode = 'criticalOnly' | 'mute';

export interface SilentHoursConfig {
  readonly enabled?: boolean;
  readonly start: string;
  readonly end: string;
  readonly mode?: SilentHoursMode;
}

export interface LaMetricDeviceConfig {
  readonly id: string;
  readonly name: string;
  readonly host: string;
  readonly protocol?: 'http' | 'https';
  readonly port?: number;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly retryCount?: number;
  readonly retryBackoffMs?: number;
  readonly connectionTestSwitch?: boolean;
  readonly silentHours?: readonly SilentHoursConfig[];
}

export interface MessageFrameConfig {
  readonly text: string;
  readonly icon?: string;
  readonly order?: number;
}

export interface MessageSoundConfig {
  readonly enabled?: boolean;
  readonly category?: SoundCategory;
  readonly id?: string;
  readonly repeat?: number;
}

export interface LaMetricMessageConfig {
  readonly id: string;
  readonly name: string;
  readonly deviceIds: readonly string[];
  readonly exposeSwitch?: boolean;
  readonly autoResetMs?: number;
  readonly cooldownMs?: number;
  readonly priority?: NotificationPriority;
  readonly iconType?: IconType;
  readonly cycles?: number;
  readonly frames: readonly MessageFrameConfig[];
  readonly sound?: MessageSoundConfig;
  readonly value?: string;
}

export interface LaMetricPlatformConfig {
  readonly platform: 'LaMetricTime';
  readonly name?: string;
  readonly debug?: boolean;
  readonly queueStrategy?: 'sequential';
  readonly maxQueueSize?: number;
  readonly duplicateStrategy?: QueueDuplicateStrategy;
  readonly globalDelayMs?: number;
  readonly testSwitch?: boolean;
  readonly silentHours?: readonly SilentHoursConfig[];
  readonly devices?: readonly LaMetricDeviceConfig[];
  readonly messages?: readonly LaMetricMessageConfig[];
}

export interface NormalizedDeviceConfig extends Required<Omit<LaMetricDeviceConfig, 'apiKey' | 'silentHours'>> {
  readonly apiKey: string;
  readonly silentHours: readonly NormalizedSilentHoursConfig[];
}

export interface NormalizedMessageSoundConfig {
  readonly enabled: boolean;
  readonly category: SoundCategory;
  readonly id: string;
  readonly repeat: number;
}

export interface NormalizedMessageConfig extends Omit<Required<LaMetricMessageConfig>, 'sound' | 'frames' | 'deviceIds'> {
  readonly deviceIds: readonly string[];
  readonly frames: readonly Required<MessageFrameConfig>[];
  readonly sound?: NormalizedMessageSoundConfig;
}

export interface NormalizedSilentHoursConfig extends Required<SilentHoursConfig> {
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export interface NormalizedPlatformConfig extends Required<Omit<LaMetricPlatformConfig, 'devices' | 'messages' | 'name' | 'silentHours'>> {
  readonly name: string;
  readonly devices: readonly NormalizedDeviceConfig[];
  readonly messages: readonly NormalizedMessageConfig[];
}
