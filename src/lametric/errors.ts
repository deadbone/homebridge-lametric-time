export class LaMetricError extends Error {
  public constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'LaMetricError';
  }
}

export class LaMetricAuthenticationError extends LaMetricError {
  public constructor(message = 'Authentication refused by LaMetric device') {
    super(message, 401, false);
    this.name = 'LaMetricAuthenticationError';
  }
}

export class LaMetricNotFoundError extends LaMetricError {
  public constructor(message = 'LaMetric endpoint was not found') {
    super(message, 404, false);
    this.name = 'LaMetricNotFoundError';
  }
}

export class LaMetricRateLimitError extends LaMetricError {
  public constructor(message = 'LaMetric device rate limit exceeded') {
    super(message, 429, true);
    this.name = 'LaMetricRateLimitError';
  }
}

export class LaMetricTimeoutError extends LaMetricError {
  public constructor(message = 'Timed out while contacting LaMetric device') {
    super(message, undefined, true);
    this.name = 'LaMetricTimeoutError';
  }
}
