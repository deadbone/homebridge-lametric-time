import type { NormalizedDeviceConfig } from '../config/types.js';
import { assertSafeHeaderValue, assertSafeHost } from '../utils/security.js';
import {
  LaMetricAuthenticationError,
  LaMetricError,
  LaMetricNotFoundError,
  LaMetricRateLimitError,
  LaMetricTimeoutError,
} from './errors.js';
import type { LaMetricDisplaySettings, LaMetricDisplayUpdate, LaMetricNotificationPayload, LaMetricNotificationResponse } from './types.js';

type DeviceEndpoint = 'notifications' | 'display' | 'device';

interface DisplayStateResponse {
  readonly brightness?: number;
  readonly brightness_mode?: string;
  readonly screensaver?: {
    readonly enabled?: boolean;
    readonly modes?: {
      readonly time_based?: LaMetricDisplaySettings['screensaver']['mode_params'];
      readonly when_dark?: { readonly enabled?: boolean };
    };
  };
}

export interface LaMetricHttpClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

export class LaMetricClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(
    private readonly device: NormalizedDeviceConfig,
    options: LaMetricHttpClientOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public async sendNotification(payload: LaMetricNotificationPayload): Promise<LaMetricNotificationResponse> {
    return this.requestWithRetry(async () => {
      const result = await this.request('POST', 'notifications', payload);
      return result === undefined ? { success: true } : result as LaMetricNotificationResponse;
    });
  }

  public async testConnection(): Promise<void> {
    await this.sendNotification({
      priority: 'critical',
      model: {
        cycles: 1,
        frames: [{ text: 'Homebridge test' }],
      },
    });
  }

  public async getDisplaySettings(): Promise<LaMetricDisplaySettings> {
    try {
      const state = await this.request('GET', 'device') as { display?: DisplayStateResponse } | undefined;
      const settings = parseDisplaySettings(state?.display);
      if (settings) {
        return settings;
      }
    } catch (error) {
      if (error instanceof LaMetricAuthenticationError) {
        throw error;
      }
    }
    const display = await this.request('GET', 'display') as DisplayStateResponse | undefined;
    const settings = parseDisplaySettings(display);
    if (!settings) {
      throw new LaMetricError(`[${this.device.name}] The device did not return its screensaver settings`);
    }
    return settings;
  }

  public async setDisplaySettings(settings: LaMetricDisplayUpdate): Promise<void> {
    const result = await this.request('PUT', 'display', settings) as {
      errors?: unknown[];
      success?: { data?: DisplayStateResponse };
    } | undefined;
    const applied = result?.success?.data?.screensaver;
    const expected = settings.screensaver;
    const appliedMode = expected && applied?.modes?.[expected.mode];
    if (result?.errors?.length || (expected && (
      (typeof applied?.enabled === 'boolean' && applied.enabled !== expected.enabled) ||
      (typeof appliedMode?.enabled === 'boolean' && appliedMode.enabled !== expected.mode_params.enabled)
    ))) {
      throw new LaMetricError(`[${this.device.name}] The device refused the display settings`);
    }
  }

  private async requestWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: LaMetricError | undefined;
    const attempts = this.device.retryCount + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const lametricError = toLaMetricError(error);
        lastError = lametricError;
        if (!lametricError.retryable || attempt >= attempts) {
          throw lametricError;
        }
        await this.sleep(this.device.retryBackoffMs * attempt);
      }
    }

    throw lastError ?? new LaMetricError('Unknown LaMetric request failure');
  }

  private async request(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: DeviceEndpoint,
    payload?: LaMetricNotificationPayload | LaMetricDisplayUpdate,
  ): Promise<unknown> {
    assertSafeHost(this.device.host);
    assertSafeHeaderValue(this.device.apiKey, 'apiKey');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.device.timeoutMs);

    try {
      const resource = endpoint === 'device' ? '?fields=display' : `/${endpoint}`;
      const response = await this.fetchImpl(`${this.device.protocol}://${this.device.host}:${this.device.port}/api/v2/device${resource}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`dev:${this.device.apiKey}`, 'utf8').toString('base64')}`,
          ...(payload && { 'Content-Type': 'application/json' }),
        },
        ...(payload && { body: JSON.stringify(payload) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await this.mapHttpError(response, endpoint);
      }

      if (response.status === 204) {
        return undefined;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : undefined;
    } catch (error) {
      if (isAbortError(error)) {
        throw new LaMetricTimeoutError(endpoint === 'notifications' ? undefined : `Timed out while contacting LaMetric device (${method} ${endpoint})`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async mapHttpError(response: Response, endpoint: DeviceEndpoint): Promise<LaMetricError> {
    const responseText = endpoint === 'notifications' ? await safeResponseText(response) : '';
    const suffix = responseText ? `: ${responseText}` : '';
    switch (response.status) {
      case 401:
        return new LaMetricAuthenticationError(`[${this.device.name}] Authentication refused by LaMetric device`);
      case 404:
        return new LaMetricNotFoundError(`[${this.device.name}] ${endpoint === 'notifications' ? 'Notification' : 'Display'} endpoint was not found`);
      case 429:
        return new LaMetricRateLimitError(`[${this.device.name}] LaMetric rate limit exceeded`);
      default:
        if (response.status >= 500) {
          return new LaMetricError(`[${this.device.name}] LaMetric returned HTTP ${response.status}${suffix}`, response.status, true);
        }
        return new LaMetricError(`[${this.device.name}] LaMetric returned HTTP ${response.status}${suffix}`, response.status, false);
    }
  }
}

function parseDisplaySettings(display: DisplayStateResponse | undefined): LaMetricDisplaySettings | undefined {
  const brightness = display?.brightness;
  const brightnessMode = display?.brightness_mode;
  const screensaver = display?.screensaver;
  const schedule = screensaver?.modes?.time_based;
  if (typeof brightness !== 'number' || !Number.isInteger(brightness) || brightness < 0 || brightness > 100 ||
      (brightnessMode !== 'auto' && brightnessMode !== 'manual') || typeof screensaver?.enabled !== 'boolean' ||
      typeof schedule?.enabled !== 'boolean') {
    return undefined;
  }
  return {
    brightness,
    brightness_mode: brightnessMode,
    screensaver: {
      enabled: screensaver.enabled,
      mode_params: {
        enabled: schedule.enabled,
        ...(typeof schedule.start_time === 'string' && { start_time: schedule.start_time }),
        ...(typeof schedule.end_time === 'string' && { end_time: schedule.end_time }),
      },
      ...(typeof screensaver.modes?.when_dark?.enabled === 'boolean' && { whenDarkEnabled: screensaver.modes.when_dark.enabled }),
    },
  };
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

function toLaMetricError(error: unknown): LaMetricError {
  if (error instanceof LaMetricError) {
    return error;
  }
  if (isAbortError(error)) {
    return new LaMetricTimeoutError();
  }
  return new LaMetricError(error instanceof Error ? error.message : 'Unknown LaMetric request failure', undefined, true);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
