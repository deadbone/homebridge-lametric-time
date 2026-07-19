import type { NormalizedPlatformConfig } from './types.js';
import { DEFAULT_PLATFORM_NAME } from '../settings.js';

export const DEFAULT_PORT_BY_PROTOCOL = {
  http: 8080,
  https: 4343,
} as const;

export const DEFAULTS = {
  platformName: DEFAULT_PLATFORM_NAME,
  debug: false,
  queueStrategy: 'sequential',
  maxQueueSize: 50,
  duplicateStrategy: 'drop',
  globalDelayMs: 250,
  testSwitch: false,
  protocol: 'http',
  timeoutMs: 5000,
  retryCount: 2,
  retryBackoffMs: 500,
  connectionTestSwitch: false,
  autoResetMs: 1000,
  cooldownMs: 0,
  priority: 'info',
  iconType: 'none',
  cycles: 1,
  soundCategory: 'notifications',
  soundRepeat: 1,
  frameOrder: 0,
  value: '',
  silentHoursEnabled: true,
  silentHoursMode: 'criticalOnly',
} satisfies Record<string, boolean | number | string>;

export const EMPTY_CONFIG: NormalizedPlatformConfig = {
  platform: 'LaMetricTime',
  name: DEFAULTS.platformName,
  debug: DEFAULTS.debug,
  queueStrategy: 'sequential',
  maxQueueSize: DEFAULTS.maxQueueSize,
  duplicateStrategy: 'drop',
  globalDelayMs: DEFAULTS.globalDelayMs,
  testSwitch: DEFAULTS.testSwitch,
  silentHours: [],
  devices: [],
  messages: [],
};
