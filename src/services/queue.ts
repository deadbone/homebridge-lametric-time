import type { QueueDuplicateStrategy } from '../config/types.js';
import type { LaMetricNotificationPayload } from '../lametric/types.js';

export interface QueueTask {
  readonly key: string;
  readonly label: string;
  readonly payload: LaMetricNotificationPayload;
  readonly cooldownMs: number;
  readonly run: () => Promise<boolean>;
}

export interface DeviceQueueOptions {
  readonly maxSize: number;
  readonly duplicateStrategy: QueueDuplicateStrategy;
}

export class DeviceQueue {
  private readonly queue: QueueTask[] = [];
  private readonly cooldowns = new Map<string, number>();
  private readonly inFlightKeys = new Set<string>();
  private running = false;
  private stopped = false;

  public constructor(private readonly options: DeviceQueueOptions) {}

  public enqueue(task: QueueTask): boolean {
    if (this.stopped || this.isCoolingDown(task.key)) {
      return false;
    }

    const duplicateIndex = this.queue.findIndex((queuedTask) => queuedTask.key === task.key);
    if (this.inFlightKeys.has(task.key) && this.options.duplicateStrategy === 'drop') {
      return false;
    }
    if (duplicateIndex >= 0) {
      if (this.options.duplicateStrategy === 'drop') {
        return false;
      }
      if (this.options.duplicateStrategy === 'replace') {
        this.queue.splice(duplicateIndex, 1, task);
        void this.process();
        return true;
      }
    }

    if (this.queue.length >= this.options.maxSize) {
      return false;
    }

    this.queue.push(task);
    void this.process();
    return true;
  }

  public stop(): void {
    this.stopped = true;
    this.queue.splice(0, this.queue.length);
  }

  public get length(): number {
    return this.queue.length;
  }

  private isCoolingDown(key: string): boolean {
    const until = this.cooldowns.get(key);
    return until !== undefined && until > Date.now();
  }

  private async process(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      while (!this.stopped) {
        const task = this.queue.shift();
        if (!task) {
          return;
        }
        let succeeded = false;
        try {
          this.inFlightKeys.add(task.key);
          succeeded = await task.run();
        } catch {
          succeeded = false;
        } finally {
          this.inFlightKeys.delete(task.key);
          if (succeeded && task.cooldownMs > 0) {
            this.cooldowns.set(task.key, Date.now() + task.cooldownMs);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}

export class QueueManager {
  private readonly queues = new Map<string, DeviceQueue>();

  public getQueue(deviceId: string, options: DeviceQueueOptions): DeviceQueue {
    const existing = this.queues.get(deviceId);
    if (existing) {
      return existing;
    }
    const queue = new DeviceQueue(options);
    this.queues.set(deviceId, queue);
    return queue;
  }

  public stopAll(): void {
    for (const queue of this.queues.values()) {
      queue.stop();
    }
  }
}
