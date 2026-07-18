import type {
  LaMetricDeviceConfig,
  LaMetricMessageConfig,
  MessageFrameConfig,
  NormalizedDeviceConfig,
  NormalizedMessageConfig,
  NormalizedPlatformConfig,
} from './types.js';
import { DEFAULT_PORT_BY_PROTOCOL, DEFAULTS, EMPTY_CONFIG } from './defaults.js';
import type { IconType, NotificationPriority, SoundCategory } from '../lametric/types.js';
import { assertSafeHost, normalizeLaMetricText, validateIcon } from '../utils/security.js';

const PRIORITIES = new Set<NotificationPriority>(['info', 'warning', 'critical']);
const ICON_TYPES = new Set<IconType>(['none', 'info', 'alert']);
const SOUND_CATEGORIES = new Set<SoundCategory>(['notifications', 'alarms']);
const DUPLICATE_STRATEGIES = new Set(['enqueue', 'drop', 'replace']);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u;

export class ConfigValidationError extends Error {
  public constructor(public readonly issues: readonly string[]) {
    super(`Invalid LaMetricTime configuration: ${issues.join('; ')}`);
    this.name = 'ConfigValidationError';
  }
}

export function normalizeConfig(input: unknown): NormalizedPlatformConfig {
  if (!isRecord(input)) {
    return EMPTY_CONFIG;
  }

  const config = input;
  if (config.platform !== 'LaMetricTime') {
    throw new ConfigValidationError(['platform must be LaMetricTime']);
  }

  const issues: string[] = [];
  const debug = optionalBoolean(config.debug, DEFAULTS.debug, 'debug', issues);
  const testSwitch = optionalBoolean(config.testSwitch, DEFAULTS.testSwitch, 'testSwitch', issues);
  const queueStrategy = optionalQueueStrategy(config.queueStrategy, issues);
  const duplicateStrategy = optionalDuplicateStrategy(config.duplicateStrategy, issues);
  const devices = normalizeDevices((config.devices ?? []) as readonly LaMetricDeviceConfig[], issues);
  const deviceIds = new Set(devices.map((device) => device.id));
  const messages = normalizeMessages((config.messages ?? []) as readonly LaMetricMessageConfig[], deviceIds, issues);
  const name = typeof config.name === 'string' ? cleanRequiredString(config.name, 'name', issues) || DEFAULTS.platformName : DEFAULTS.platformName;
  const maxQueueSize = boundedInteger(config.maxQueueSize as number | undefined, DEFAULTS.maxQueueSize, 1, 500, 'maxQueueSize', issues);
  const globalDelayMs = boundedInteger(config.globalDelayMs as number | undefined, DEFAULTS.globalDelayMs, 0, 60000, 'globalDelayMs', issues);

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    platform: 'LaMetricTime',
    name,
    debug,
    queueStrategy,
    maxQueueSize,
    duplicateStrategy,
    globalDelayMs,
    testSwitch,
    devices,
    messages,
  };
}

function optionalBoolean(value: unknown, fallback: boolean, label: string, issues: string[]): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    issues.push(`${label} must be a boolean`);
    return fallback;
  }
  return value;
}

function optionalQueueStrategy(value: unknown, issues: string[]): 'sequential' {
  if (value === undefined) {
    return 'sequential';
  }
  if (value !== 'sequential') {
    issues.push('queueStrategy must be sequential');
  }
  return 'sequential';
}

function optionalDuplicateStrategy(value: unknown, issues: string[]): 'enqueue' | 'drop' | 'replace' {
  if (value === undefined) {
    return 'drop';
  }
  if (typeof value !== 'string' || !DUPLICATE_STRATEGIES.has(value)) {
    issues.push('duplicateStrategy must be enqueue, drop, or replace');
    return 'drop';
  }
  return value as 'enqueue' | 'drop' | 'replace';
}

function normalizeDevices(devices: readonly LaMetricDeviceConfig[], issues: string[]): readonly NormalizedDeviceConfig[] {
  if (!Array.isArray(devices)) {
    issues.push('devices must be an array');
    return [];
  }

  const ids = new Set<string>();
  return devices.map((device, index) => {
    const label = `devices[${index}]`;
    const id = cleanId(device.id, `${label}.id`, issues);
    if (ids.has(id)) {
      issues.push(`${label}.id must be unique`);
    }
    ids.add(id);

    const protocol = device.protocol === 'https' ? 'https' : 'http';
    if (device.protocol !== undefined && device.protocol !== 'http' && device.protocol !== 'https') {
      issues.push(`${label}.protocol must be http or https`);
    }

    const host = cleanRequiredString(device.host, `${label}.host`, issues);
    try {
      assertSafeHost(host);
    } catch (error) {
      issues.push(`${label}.host ${(error as Error).message}`);
    }

    const apiKey = cleanRequiredString(device.apiKey, `${label}.apiKey`, issues);

    return {
      id,
      name: cleanRequiredString(device.name, `${label}.name`, issues),
      host,
      protocol,
      port: boundedInteger(device.port, DEFAULT_PORT_BY_PROTOCOL[protocol], 1, 65535, `${label}.port`, issues),
      apiKey,
      timeoutMs: boundedInteger(device.timeoutMs, DEFAULTS.timeoutMs, 250, 60000, `${label}.timeoutMs`, issues),
      retryCount: boundedInteger(device.retryCount, DEFAULTS.retryCount, 0, 5, `${label}.retryCount`, issues),
      retryBackoffMs: boundedInteger(device.retryBackoffMs, DEFAULTS.retryBackoffMs, 0, 30000, `${label}.retryBackoffMs`, issues),
      connectionTestSwitch: optionalBoolean(device.connectionTestSwitch, DEFAULTS.connectionTestSwitch, `${label}.connectionTestSwitch`, issues),
    };
  });
}

function normalizeMessages(
  messages: readonly LaMetricMessageConfig[],
  deviceIds: ReadonlySet<string>,
  issues: string[],
): readonly NormalizedMessageConfig[] {
  if (!Array.isArray(messages)) {
    issues.push('messages must be an array');
    return [];
  }

  const ids = new Set<string>();
  return messages.map((message, index) => {
    const label = `messages[${index}]`;
    const id = cleanId(message.id, `${label}.id`, issues);
    if (ids.has(id)) {
      issues.push(`${label}.id must be unique`);
    }
    ids.add(id);

    if (!Array.isArray(message.deviceIds) || message.deviceIds.length === 0) {
      issues.push(`${label}.deviceIds must reference at least one device`);
    }
    const targetDeviceIds = [...(message.deviceIds ?? [])].filter((deviceId) => {
      if (!deviceIds.has(deviceId)) {
        issues.push(`${label}.deviceIds references unknown device "${deviceId}"`);
        return false;
      }
      return true;
    });

    const priority = message.priority ?? DEFAULTS.priority;
    if (!PRIORITIES.has(priority)) {
      issues.push(`${label}.priority must be info, warning, or critical`);
    }

    const iconType = message.iconType ?? DEFAULTS.iconType;
    if (!ICON_TYPES.has(iconType)) {
      issues.push(`${label}.iconType must be none, info, or alert`);
    }

    const sound = normalizeSound(message.sound, `${label}.sound`, issues);

    const normalized: Omit<NormalizedMessageConfig, 'sound'> & { sound?: NonNullable<NormalizedMessageConfig['sound']> } = {
      id,
      name: cleanRequiredString(message.name, `${label}.name`, issues),
      deviceIds: targetDeviceIds,
      exposeSwitch: message.exposeSwitch ?? true,
      autoResetMs: boundedInteger(message.autoResetMs, DEFAULTS.autoResetMs, 100, 60000, `${label}.autoResetMs`, issues),
      cooldownMs: boundedInteger(message.cooldownMs, DEFAULTS.cooldownMs, 0, 86400000, `${label}.cooldownMs`, issues),
      priority,
      iconType,
      cycles: boundedInteger(message.cycles, DEFAULTS.cycles, 1, 100, `${label}.cycles`, issues),
      frames: normalizeFrames(message.frames, `${label}.frames`, issues),
      value: message.value ?? DEFAULTS.value,
    };
    if (sound) {
      normalized.sound = sound;
    }
    return normalized;
  });
}

function normalizeFrames(frames: readonly MessageFrameConfig[], label: string, issues: string[]): readonly Required<MessageFrameConfig>[] {
  if (!Array.isArray(frames) || frames.length === 0) {
    issues.push(`${label} must contain at least one frame`);
    return [];
  }

  return [...frames]
    .map((frame, index) => {
      const text = normalizeLaMetricText(frame.text ?? '');
      if (text.length === 0) {
        issues.push(`${label}[${index}].text is required`);
      }
      const icon = frame.icon ?? '';
      if (icon && !validateIcon(icon)) {
        issues.push(`${label}[${index}].icon must be a LaMetric i/a icon id or a small PNG data URI`);
      }
      return {
        text,
        icon,
        order: boundedInteger(frame.order, index, 0, 999, `${label}[${index}].order`, issues),
      };
    })
    .sort((left, right) => left.order - right.order);
}

function normalizeSound(sound: LaMetricMessageConfig['sound'], label: string, issues: string[]) {
  if (!sound?.enabled) {
    return undefined;
  }
  const category = sound.category ?? 'notifications';
  if (!SOUND_CATEGORIES.has(category)) {
    issues.push(`${label}.category must be notifications or alarms`);
  }
  const id = cleanRequiredString(sound.id, `${label}.id`, issues);
  return {
    enabled: true,
    category,
    id,
    repeat: boundedInteger(sound.repeat, DEFAULTS.soundRepeat, 0, 20, `${label}.repeat`, issues),
  };
}

function cleanId(value: string | undefined, label: string, issues: string[]): string {
  const id = cleanRequiredString(value, label, issues);
  if (!ID_PATTERN.test(id)) {
    issues.push(`${label} must be 1-64 characters and contain only letters, numbers, underscore, or dash`);
  }
  return id;
}

function cleanRequiredString(value: string | undefined, label: string, issues: string[]): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length === 0) {
    issues.push(`${label} is required`);
  }
  return normalized;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
  issues: string[],
): number {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) {
    issues.push(`${label} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
