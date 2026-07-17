# Changelog

All notable changes to this project are documented in this file.

## 0.1.2

### Changed

- Added scoped plugin migration readiness for a future `@homebridge-plugins/homebridge-lametric-time-messenger` package.
- Stabilized the HomeKit accessory UUID namespace so a future scoped package can keep the same accessory UUIDs.
- Documented the Homebridge scoped plugin migration path.

## 0.1.1

Maintenance release.

### Changed

- Updated the changelog to document the stable release and previous alpha/beta history.
- Included `CHANGELOG.md` in the npm package.
- Updated package verification so `CHANGELOG.md` is required in the npm archive.

## 0.1.0

Stable release of `homebridge-lametric-time-messenger`.

### Added

- Homebridge dynamic platform plugin for LaMetric TIME V2 / 2022+ local notifications.
- Support for one or more configured LaMetric TIME V2 devices.
- HomeKit virtual switches for triggering configured LaMetric messages.
- Configurable messages with:
  - target LaMetric device IDs;
  - one or more display frames;
  - LaMetric frame icons;
  - `{{date}}`, `{{time}}`, `{{name}}`, and `{{value}}` template variables;
  - notification priority: `info`, `warning`, or `critical`;
  - notification icon type: `none`, `info`, or `alert`;
  - optional notification sounds;
  - display cycles;
  - automatic HomeKit switch reset.
- In-memory per-device notification queues.
- Queue duplicate handling with `enqueue`, `drop`, and `replace` strategies.
- Per-message cooldowns applied after successful sends.
- Global per-device delay between LaMetric API calls.
- Retry and timeout handling for local LaMetric API requests.
- Homebridge UI `config.schema.json` with sections for general settings, devices, messages, frames, and sounds.
- Global HomeKit test switch option.
- Original plugin icon asset included in the npm package and README.
- Bilingual README: English first, then French.
- Bilingual GitHub wiki documentation: English first, then French.
- GitHub release `v0.1.0`.

### Changed

- Renamed the npm package to `homebridge-lametric-time-messenger` so it follows Homebridge plugin naming expectations.
- Promoted the package from alpha/beta releases to stable `0.1.0`.
- Documented compatibility as LaMetric TIME V2 / 2022+ only.
- Updated the Homebridge UI configuration wording to make the LaMetric TIME V2 requirement explicit.
- Improved Homebridge UI array rendering by using the schema `form` layout expected by Homebridge UI.
- Updated the global test notification to use `critical` priority so it still works when the LaMetric only accepts critical notifications.
- Omitted `icon_type` from the LaMetric payload when the configured icon type is `none`.
- Improved LaMetric HTTP error logging by including response details returned by the device.

### Fixed

- Fixed configuration validation for queue, duplicate strategy, numeric limits, and boolean options.
- Fixed Homebridge UI device and message array controls so devices, messages, frames, and target device IDs can be entered from the UI.
- Fixed cooldown behavior so failed sends do not trigger the cooldown.
- Fixed queue behavior for per-message cooldowns sharing the same device queue.
- Fixed packaging checks to ensure the compiled output, config schema, README, license, and icon are included.
- Fixed stale package naming references after renaming.
- Fixed wiki branch alignment so GitHub displays the updated wiki content.

### Security

- API keys and Authorization headers are not logged by the plugin.
- The plugin does not include telemetry or analytics.
- The plugin accepts protocol, host, and port fields instead of arbitrary URLs.
- Host, header, text, and icon inputs are validated before use.
- Queues are in memory only and are not persisted to disk.

## 0.1.0-beta.4

- Renamed package and Homebridge plugin identifier to `homebridge-lametric-time-messenger`.
- Updated README, tests, and wiki references to the final Homebridge-compatible package name.

## 0.1.0-beta.3

- Renamed the package to `lametric-time-messenger`.
- Updated README installation instructions and Homebridge plugin identifier.

## 0.1.0-beta.2

- Documented LaMetric TIME V2 / 2022+ compatibility.
- Marked first-generation LaMetric TIME devices as unsupported.
- Updated Homebridge UI wording for device configuration.

## 0.1.0-beta.1

- Bumped beta version after the initial beta promotion.

## 0.1.0-beta.0

- Promoted the plugin from alpha to beta.
- Updated package and README release wording from alpha to beta.

## 0.1.0-alpha.5

- Updated global test notifications to use `critical` priority.
- Added documentation for LaMetric devices that only accept `critical` notifications in restrictive modes.
- Added tests for connection-test priority behavior.

## 0.1.0-alpha.4

- Improved LaMetric HTTP 400 error diagnostics by including the device response body.
- Omitted `icon_type` when the icon type is configured as `none`.
- Added tests for LaMetric error details and payload generation.

## 0.1.0-alpha.3

- Fixed Homebridge UI configuration form rendering by switching to the supported schema `form` layout.
- Made nested arrays usable for devices, messages, target device IDs, and frames.

## 0.1.0-alpha.2

- Added original plugin icon asset.
- Included icon asset in npm packaging checks.
- Updated README to display the plugin icon.

## 0.1.0-alpha.1

- Prepared npm alpha publication.
- Renamed the original package to avoid an existing npm package name conflict.
- Added package verification checks before publish.

## 0.1.0-alpha.0

- Initial alpha release.
- Initial dynamic platform implementation.
- Local LaMetric Device API v2 notification client.
- HomeKit virtual switches per configured message.
- In-memory per-device queue, cooldown, deduplication, retries, and timeouts.
- Homebridge UI schema.
- Unit and integration-style tests with mocked LaMetric API.
