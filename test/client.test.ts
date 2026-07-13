import { describe, expect, it, vi } from 'vitest';
import { sampleConfig, response } from './helpers.js';
import { LaMetricClient } from '../src/lametric/client.js';
import { LaMetricAuthenticationError, LaMetricTimeoutError } from '../src/lametric/errors.js';
import type { LaMetricNotificationPayload } from '../src/lametric/types.js';

const payload: LaMetricNotificationPayload = {
  priority: 'info',
  icon_type: 'none',
  model: { cycles: 1, frames: [{ text: 'Hello' }] },
};

describe('LaMetricClient', () => {
  it('sends correct Basic auth without exposing the secret in errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200));
    const client = new LaMetricClient(sampleConfig.devices[0], { fetchImpl });
    await client.sendNotification(payload);
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('dev:SECRET').toString('base64')}`);
  });

  it('handles HTTP 200 success', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200, { id: '50' }));
    const client = new LaMetricClient(sampleConfig.devices[0], { fetchImpl });
    await expect(client.sendNotification(payload)).resolves.toEqual({ id: '50' });
  });

  it('uses critical priority for connection tests', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200));
    const client = new LaMetricClient(sampleConfig.devices[0], { fetchImpl });
    await client.testConnection();
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string) as LaMetricNotificationPayload;
    expect(body.priority).toBe('critical');
    expect(body.icon_type).toBeUndefined();
  });

  it('maps HTTP 401 and does not retry', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, { error: 'bad SECRET' }));
    const client = new LaMetricClient(sampleConfig.devices[0], { fetchImpl });
    await expect(client.sendNotification(payload)).rejects.toBeInstanceOf(LaMetricAuthenticationError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('includes LaMetric error details for bad requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(400, { errors: ['invalid payload'] }));
    const client = new LaMetricClient(sampleConfig.devices[0], { fetchImpl });
    await expect(client.sendNotification(payload)).rejects.toThrow(/invalid payload/u);
  });

  it('maps network timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      init?.signal?.dispatchEvent(new Event('abort'));
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const client = new LaMetricClient({ ...sampleConfig.devices[0], retryCount: 0 }, { fetchImpl });
    await expect(client.sendNotification(payload)).rejects.toBeInstanceOf(LaMetricTimeoutError);
  });

  it('retries retryable 5xx responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(500)).mockResolvedValueOnce(response(200));
    const client = new LaMetricClient({ ...sampleConfig.devices[0], retryCount: 1, retryBackoffMs: 0 }, { fetchImpl, sleep: async () => undefined });
    await expect(client.sendNotification(payload)).resolves.toEqual({ success: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
