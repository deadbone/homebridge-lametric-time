const HEADER_UNSAFE = /[\r\n]/u;
const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/u;
const ICON_PATTERN = /^(?:[ia]\d+|data:image\/png;base64,[A-Za-z0-9+/=]+)$/u;

export function assertSafeHeaderValue(value: string, label: string): void {
  if (HEADER_UNSAFE.test(value)) {
    throw new Error(`${label} contains characters that are not allowed in HTTP headers`);
  }
}

export function assertSafeHost(host: string): void {
  if (!HOST_PATTERN.test(host) || host.includes('..') || host.startsWith('.') || host.endsWith('.')) {
    throw new Error('host must be an IP address or DNS name, not a URL');
  }
}

export function sanitizeHomeKitName(name: string): string {
  return name.replace(/[^\p{L}\p{N} ._'()-]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 64) || 'LaMetric Message';
}

export function normalizeLaMetricText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 256);
}

export function validateIcon(icon: string): boolean {
  return icon.length <= 4096 && ICON_PATTERN.test(icon);
}

export function redactSecrets(input: string, secrets: readonly string[]): string {
  return secrets.reduce((message, secret) => {
    if (!secret) {
      return message;
    }
    return message.split(secret).join('[REDACTED]');
  }, input);
}
