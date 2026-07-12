import { normalizeLaMetricText } from '../utils/security.js';

export interface TemplateContext {
  readonly date?: string;
  readonly time?: string;
  readonly name?: string;
  readonly value?: string | number | boolean;
}

export class TemplateEngine {
  public render(template: string, context: TemplateContext, now = new Date()): string {
    const values = {
      date: context.date ?? new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(now),
      time: context.time ?? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(now),
      name: context.name ?? '',
      value: context.value === undefined ? '' : String(context.value),
    } satisfies Record<string, string>;

    return normalizeLaMetricText(template.replace(/\{\{\s*(date|time|name|value)\s*\}\}/gu, (_match, key: keyof typeof values) => values[key]));
  }
}
