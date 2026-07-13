import type { NormalizedMessageConfig } from '../config/types.js';
import { TemplateEngine, type TemplateContext } from '../services/template-engine.js';
import type { LaMetricNotificationPayload } from './types.js';

export class NotificationBuilder {
  public constructor(private readonly templateEngine = new TemplateEngine()) {}

  public build(message: NormalizedMessageConfig, context: TemplateContext = {}): LaMetricNotificationPayload {
    const frames = message.frames.map((frame) => {
      const templateContext = {
        name: context.name ?? message.name,
        value: context.value ?? message.value,
        ...(context.date ? { date: context.date } : {}),
        ...(context.time ? { time: context.time } : {}),
      };
      const rendered = this.templateEngine.render(frame.text, templateContext);
      return frame.icon ? { icon: frame.icon, text: rendered } : { text: rendered };
    });

    return {
      priority: message.priority,
      ...(message.iconType !== 'none' ? { icon_type: message.iconType } : {}),
      model: {
        cycles: message.cycles,
        frames,
        ...(message.sound?.enabled
          ? {
              sound: {
                category: message.sound.category,
                id: message.sound.id,
                repeat: message.sound.repeat,
              },
            }
          : {}),
      },
    };
  }
}
