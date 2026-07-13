# homebridge-lametric-time

Dynamic Homebridge platform plugin for sending local notifications to one or more LaMetric TIME clocks.

> Alpha release: this plugin is versioned as `0.1.0-alpha.0`. It has automated tests and compiles, but it still needs validation with real LaMetric TIME hardware before being considered stable.

The plugin uses the LaMetric Device API v2 local endpoint:

```text
POST http://<device-host>:8080/api/v2/device/notifications
```

HTTPS on port `4343` can be configured, but the plugin does not disable TLS verification globally. If your device uses a self-signed local certificate and Node rejects it, prefer HTTP on a trusted local network for now.

## Compatibility

- Homebridge: `^1.6.0 || ^2.0.0`
- Node.js: `^22.12.0 || ^24.0.0`
- Plugin type: dynamic platform
- Module format: ESM

Homebridge 2 compatibility is based on the official dynamic platform model and avoids deprecated callback characteristics by using `onGet` and `onSet`.

## Installation

### Install From GitHub

The package is currently alpha and not published to npm. Install it directly from GitHub:

```sh
npm install -g git+https://github.com/deadbone/homebridge-lametric-time.git
```

The Git install runs the package `prepare` script, which compiles TypeScript into `dist/` so Homebridge can load `dist/index.js`.

### Local Development Install

```sh
npm install
npm run build
npm link
```

### Future npm Install

After the package is published to npm, installation will use:

```sh
npm install -g homebridge-lametric-time
```

## LaMetric Local API Key

Enable or retrieve the local Device API key from your LaMetric developer/device settings. The plugin authenticates with HTTP Basic auth:

- user: `dev`
- password: your local LaMetric API key

The key is configured as a Homebridge UI password field and is never logged by the plugin.

## Homebridge UI Configuration

The plugin ships a `config.schema.json`, so Homebridge UI can render the configuration form without a custom UI.

Sections:

- General settings: debug logging, queue size, duplicate behavior, global delay, optional test switch.
- LaMetric devices: internal ID, display name, host, protocol, port, API key, timeout, retries.
- Messages: internal ID, name, target devices, HomeKit switch exposure, auto-reset, cooldown, priority, icon type, cycles, frames, optional sound.

The schema can mask the API key with `format: password`. Per-device connection test buttons are not included in this version because the standard schema form does not provide a reliable server-side button flow by itself.

## Example Configuration

```json
{
  "platform": "LaMetricTime",
  "name": "LaMetric Time",
  "debug": false,
  "maxQueueSize": 50,
  "duplicateStrategy": "drop",
  "globalDelayMs": 250,
  "testSwitch": true,
  "devices": [
    {
      "id": "salon",
      "name": "LaMetric Salon",
      "host": "192.168.1.50",
      "protocol": "http",
      "port": 8080,
      "apiKey": "SECRET",
      "timeoutMs": 5000,
      "retryCount": 2,
      "retryBackoffMs": 500
    }
  ],
  "messages": [
    {
      "id": "front-door-open",
      "name": "Porte ouverte",
      "deviceIds": ["salon"],
      "exposeSwitch": true,
      "autoResetMs": 1000,
      "cooldownMs": 5000,
      "priority": "info",
      "iconType": "none",
      "cycles": 1,
      "frames": [
        {
          "order": 0,
          "icon": "a1234",
          "text": "Porte {{name}} ouverte"
        }
      ],
      "sound": {
        "enabled": true,
        "category": "notifications",
        "id": "positive1",
        "repeat": 1
      }
    }
  ]
}
```

## Home App Automation Example

1. A HomeKit contact sensor detects that a front door opened.
2. An Apple Home automation turns on the virtual switch `Porte ouverte`.
3. Homebridge builds and queues the configured LaMetric notification.
4. The plugin sends the notification locally to the selected LaMetric.
5. The switch automatically returns to off after `autoResetMs`.

The plugin does not claim to observe every accessory managed by other Homebridge plugins directly. Use Apple Home automations or another supported trigger to turn on the virtual switch.

## Notifications

Each message contains one or more frames. Frames are sorted by `order` during configuration validation.

Supported template variables:

- `{{date}}`
- `{{time}}`
- `{{name}}`
- `{{value}}`

Missing values render as an empty string. Templates do not execute JavaScript and do not use `eval` or `Function`.

## Priorities, Icons, And Sounds

The LaMetric Device API documents notification priorities:

- `info`: normal queue priority.
- `warning`: higher priority than internal notifications.
- `critical`: interrupts other notifications and wakes the device from sleep/screensaver.

`iconType` supports `none`, `info`, and `alert`.

Frame icons can use LaMetric icon IDs such as:

- `i1234` for a static icon.
- `a1234` for an animated icon.

Sound categories supported by the API are `notifications` and `alarms`. The plugin omits the `sound` object entirely when sound is disabled.

## Queue And Anti-Spam

The plugin keeps in-memory queues per LaMetric device:

- processing is sequential per device;
- different devices can process independently;
- queue size is limited;
- cooldown is applied per message after a successful send only;
- duplicates can be enqueued, dropped, or replaced;
- failures are logged and the queue continues.

Queues are not persisted. API keys and notification payloads are not written to log files by the plugin.

## Troubleshooting

`401 Authentication refused`: verify the local API key and ensure there are no extra spaces.

`404 endpoint not found`: verify the host, port, protocol, and that the device supports Device API v2 notifications.

Timeout or unreachable device: verify that Homebridge can reach the LaMetric on the local network. HTTP usually uses port `8080`; HTTPS usually uses port `4343`.

`429 rate limit`: increase `globalDelayMs`, reduce automations that trigger the same message, or use cooldowns.

## Security

- No cloud service is used.
- No telemetry is included.
- The plugin accepts host, protocol, and port, not arbitrary URLs.
- Only `http` and `https` protocols are accepted.
- Header injection characters are rejected.
- Text and payload inputs are bounded.
- API keys and Authorization headers are never logged.
- TLS validation is not disabled globally.

## Development

```sh
npm install
npm run lint
npm run build
npm test
npm run verify:pack
```

Tests mock the LaMetric API and do not require a real device.

## Publishing

Before publishing:

1. Set `private` to `false` or remove it from `package.json`.
2. Confirm repository, bugs, homepage, author, and license metadata.
3. Run `npm run lint`, `npm run build`, `npm test`, and `npm run verify:pack`.
4. Publish with `npm publish`.

For a scoped package, use `npm publish --access=public` the first time.
