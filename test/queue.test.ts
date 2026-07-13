import { describe, expect, it, vi } from 'vitest';
import { DeviceQueue, QueueManager } from '../src/services/queue.js';
import type { LaMetricNotificationPayload } from '../src/lametric/types.js';

const payload: LaMetricNotificationPayload = {
  priority: 'info',
  model: { frames: [{ text: 'Hello' }] },
};

describe('DeviceQueue', () => {
  it('applies cooldown to a message', async () => {
    const run = vi.fn(async () => true);
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue' });
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, cooldownMs: 1000, run })).toBe(true);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, cooldownMs: 1000, run })).toBe(false);
  });

  it('deduplicates queued work', () => {
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'drop' });
    const never = () => new Promise<void>(() => undefined);
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, cooldownMs: 0, run: async () => never().then(() => true) })).toBe(true);
    expect(queue.enqueue({ key: 'same', label: 'Same', payload, cooldownMs: 0, run: vi.fn() })).toBe(false);
  });

  it('processes tasks in order', async () => {
    const order: string[] = [];
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue' });
    queue.enqueue({ key: 'one', label: 'One', payload, cooldownMs: 0, run: async () => order.push('one') > 0 });
    queue.enqueue({ key: 'two', label: 'Two', payload, cooldownMs: 0, run: async () => order.push('two') > 0 });
    await vi.waitFor(() => expect(order).toEqual(['one', 'two']));
  });

  it('keeps device queues independent', async () => {
    const manager = new QueueManager();
    const order: string[] = [];
    const first = manager.getQueue('first', { maxSize: 10, duplicateStrategy: 'enqueue' });
    const second = manager.getQueue('second', { maxSize: 10, duplicateStrategy: 'enqueue' });
    first.enqueue({ key: 'one', label: 'One', payload, cooldownMs: 0, run: async () => order.push('first') > 0 });
    second.enqueue({ key: 'one', label: 'One', payload, cooldownMs: 0, run: async () => order.push('second') > 0 });
    await vi.waitFor(() => expect(order.sort()).toEqual(['first', 'second']));
  });

  it('uses each task cooldown for messages sharing the same device queue', async () => {
    const queue = new QueueManager().getQueue('same-device', { maxSize: 10, duplicateStrategy: 'enqueue' });
    const firstRun = vi.fn(async () => true);
    const secondRun = vi.fn(async () => true);

    expect(queue.enqueue({ key: 'with-cooldown', label: 'With Cooldown', payload, cooldownMs: 1000, run: firstRun })).toBe(true);
    expect(queue.enqueue({ key: 'without-cooldown', label: 'Without Cooldown', payload, cooldownMs: 0, run: secondRun })).toBe(true);

    await vi.waitFor(() => {
      expect(firstRun).toHaveBeenCalledTimes(1);
      expect(secondRun).toHaveBeenCalledTimes(1);
    });

    expect(queue.enqueue({ key: 'with-cooldown', label: 'With Cooldown', payload, cooldownMs: 1000, run: firstRun })).toBe(false);
    expect(queue.enqueue({ key: 'without-cooldown', label: 'Without Cooldown', payload, cooldownMs: 0, run: secondRun })).toBe(true);
  });

  it('does not apply cooldown after a failed send result', async () => {
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue' });
    const run = vi.fn(async () => false);

    expect(queue.enqueue({ key: 'failed', label: 'Failed', payload, cooldownMs: 1000, run })).toBe(true);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(queue.enqueue({ key: 'failed', label: 'Failed', payload, cooldownMs: 1000, run })).toBe(true);
  });

  it('continues processing after a task throws', async () => {
    const queue = new DeviceQueue({ maxSize: 10, duplicateStrategy: 'enqueue' });
    const order: string[] = [];

    queue.enqueue({
      key: 'throws',
      label: 'Throws',
      payload,
      cooldownMs: 1000,
      run: async () => {
        order.push('throws');
        throw new Error('send failed');
      },
    });
    queue.enqueue({ key: 'next', label: 'Next', payload, cooldownMs: 0, run: async () => order.push('next') > 0 });

    await vi.waitFor(() => expect(order).toEqual(['throws', 'next']));
    expect(queue.enqueue({ key: 'throws', label: 'Throws', payload, cooldownMs: 1000, run: async () => true })).toBe(true);
  });
});
