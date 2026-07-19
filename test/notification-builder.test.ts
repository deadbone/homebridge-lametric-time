import { describe, expect, it } from 'vitest';
import { NotificationBuilder } from '../src/lametric/notification-builder.js';
import { sampleMessage } from './helpers.js';

describe('NotificationBuilder', () => {
  it('builds a notification with one frame', () => {
    const payload = new NotificationBuilder().build(sampleMessage);
    expect(payload.model.frames).toEqual([{ icon: 'a1234', text: 'Door Front door open open' }]);
    expect(payload.priority).toBe('info');
  });

  it('builds a notification with multiple frames', () => {
    const payload = new NotificationBuilder().build({
      ...sampleMessage,
      frames: [
        { text: 'Second', icon: '', order: 2 },
        { text: 'First', icon: 'i1234', order: 1 },
      ],
    });
    expect(payload.model.frames).toHaveLength(2);
    expect(payload.model.frames[0]).toEqual({ text: 'Second' });
  });

  it('omits sound when it is disabled', () => {
    const payload = new NotificationBuilder().build({
      ...sampleMessage,
      sound: undefined,
    });
    expect(payload.model.sound).toBeUndefined();
  });

  it('omits sound when requested', () => {
    const payload = new NotificationBuilder().build(sampleMessage, {}, { includeSound: false });
    expect(payload.model.sound).toBeUndefined();
  });

  it('omits icon_type when icon type is none', () => {
    const payload = new NotificationBuilder().build({
      ...sampleMessage,
      iconType: 'none',
    });
    expect(payload.icon_type).toBeUndefined();
  });
});
