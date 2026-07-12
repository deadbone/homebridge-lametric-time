export class RateLimiter {
  private lastRunAt = 0;

  public constructor(private readonly minDelayMs: number) {}

  public async wait(sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<void> {
    const elapsed = Date.now() - this.lastRunAt;
    const remaining = this.minDelayMs - elapsed;
    if (remaining > 0) {
      await sleep(remaining);
    }
    this.lastRunAt = Date.now();
  }
}
