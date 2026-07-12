import type { NormalizedDeviceConfig } from '../config/types.js';
import { assertSafeHeaderValue, assertSafeHost } from '../utils/security.js';
import {
  LaMetricAuthenticationError,
  LaMetricError,
  LaMetricNotFoundError,
  LaMetricRateLimitError,
  LaMetricTimeoutError,
} from './errors.js';
import type { LaMetricNotificationPayload, LaMetricNotificationResponse } from './types.js';

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
    return this.requestWithRetry(payload);
  }

  public async testConnection(): Promise<void> {
    await this.requestWithRetry({
      priority: 'info',
      icon_type: 'none',
      model: {
        cycles: 1,
        frames: [{ text: 'Homebridge test' }],
      },
    });
  }

  private async requestWithRetry(payload: LaMetricNotificationPayload): Promise<LaMetricNotificationResponse> {
    let lastError: LaMetricError | undefined;
    const attempts = this.device.retryCount + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.postNotification(payload);
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

  private async postNotification(payload: LaMetricNotificationPayload): Promise<LaMetricNotificationResponse> {
    assertSafeHost(this.device.host);
    assertSafeHeaderValue(this.device.apiKey, 'apiKey');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.device.timeoutMs);

    try {
      const response = await this.fetchImpl(this.notificationUrl(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`dev:${this.device.apiKey}`, 'utf8').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await this.mapHttpError(response);
      }

      if (response.status === 204) {
        return { success: true };
      }

      const text = await response.text();
      if (!text) {
        return { success: true };
      }
      return JSON.parse(text) as LaMetricNotificationResponse;
    } catch (error) {
      if (isAbortError(error)) {
        throw new LaMetricTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private notificationUrl(): string {
    return `${this.device.protocol}://${this.device.host}:${this.device.port}/api/v2/device/notifications`;
  }

  private async mapHttpError(response: Response): Promise<LaMetricError> {
    switch (response.status) {
      case 401:
        return new LaMetricAuthenticationError(`[${this.device.name}] Authentication refused by LaMetric device`);
      case 404:
        return new LaMetricNotFoundError(`[${this.device.name}] Notification endpoint was not found`);
      case 429:
        return new LaMetricRateLimitError(`[${this.device.name}] LaMetric rate limit exceeded`);
      default:
        if (response.status >= 500) {
          return new LaMetricError(`[${this.device.name}] LaMetric returned HTTP ${response.status}`, response.status, true);
        }
        return new LaMetricError(`[${this.device.name}] LaMetric returned HTTP ${response.status}`, response.status, false);
    }
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
