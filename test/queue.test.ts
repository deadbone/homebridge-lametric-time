import { describe, expect, it, vi } from 'vitest';
import { DeviceQueue, QueueManager } from '../src/services/queue.js';
import type { LaMetricNotificationPayload } from '../src/lametric/types.js';

const payload: LaMetricNotificationPayload = {
  priority: 'info',
  model: { frames: [{ text: 'Hello' }] },
};

describe('DeviceQueue', () => {
  it('applies cooldown to a message', async () => {
    const run = vi.fn(async () => undefined);
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue', cooldownMs: 1000 });
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, run })).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, run })).toBe(false);
  });

  it('deduplicates queued work', () => {
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'drop', cooldownMs: 0 });
    const never = () => new Promise<void>(() => undefined);
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, run: never })).toBe(true);
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, run: vi.fn() })).toBe(false);
  });

  it('processes tasks in order', async () => {
    const order: string[] = [];
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue', cooldownMs: 0 });
    queue.enqueue({ key: 'one', label: 'One', payload, run: async () => order.push('one') });
    queue.enqueue({ key: 'two', label: 'Two', payload, run: async () => order.push('two') });
    await vi.waitFor(() => expect(order).toEqual(['one', 'two']));
  });

  it('keeps device queues independent', async () => {
    const manager = new QueueManager();
    const order: string[] = [];
    const first = manager.getQueue('first', { maxSize: 10, duplicateStrategy: 'enqueue', cooldownMs: 0 });
    const second = manager.getQueue('second', { maxSize: 10, duplicateStrategy: 'enqueue', cooldownMs: 0 });
    first.enqueue({ key: 'one', label: 'One', payload, run: async () => order.push('first') });
    second.enqueue({ key: 'one', label: 'One', payload, run: async () => order.push('second') });
    await vi.waitFor(() => expect(order.sort()).toEqual(['first', 'second']));
  });
});
