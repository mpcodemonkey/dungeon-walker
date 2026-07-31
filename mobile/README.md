# Dungeon Walker — Mobile

Expo (React Native + TypeScript) client for iOS and Android.

## Current state

Sign up / log in against the server, then a map screen: requests
foreground location permission, renders a MapLibre map (self-hosted
Protomaps vector tiles served by `/server`, see
`docs/maplibre-migration.md`) centered on the device's live position with
a placeholder marker for the player avatar, and shows the signed-in
character's name/level plus banked Activity Points (AP) in the header,
with a log-out button. Steps sync to the server periodically;
with no active encounter they bank as AP, with one active they deal live
damage instead (see `docs/chunk-4-combat.md`). When an encounter spawns,
a card appears with Engage/Walk away (pending) or a vitality bar and
Spend AP button (active); defeating one shows a banner with XP/level-up.
No loot/gear or dungeons yet.

Step tracking is platform-split (`src/movement/stepSource.ios.ts` /
`stepSource.android.ts`, picked automatically by Metro/TypeScript based on
the file suffix):

- **iOS**: `expo-sensors`' `Pedometer` (CMPedometer). Works inside Expo Go.
- **Android**: **Health Connect**, via `react-native-health-connect`.
  `expo-sensors`' Pedometer on Android is unreliable — multiple open
  upstream issues report permission resolving but step events never
  firing. Health Connect is Android's standard fitness-data store instead.

**This means both platforms need a custom dev client, not Expo Go.**
Android needed one already: Health Connect's native module isn't part of
Expo Go's fixed binary, so Metro bundles fine but the app fails on-device
without a build that actually includes it. iOS used to be exempt (Apple
Maps via `react-native-maps` ships inside Expo Go), but MapLibre
(`@maplibre/maplibre-react-native`) is also a third-party native module
Expo Go doesn't bundle — so iOS needs its own dev client build now too,
the same way Android already does.

## Setup

```
npm install
cp .env.example .env   # point EXPO_PUBLIC_API_URL at your running server, see comments in the file
```

### iOS (needs a custom dev client)

**A. EAS Build (cloud, recommended — no local Xcode/macOS needed)**
```
npx eas login                                    # free Expo account
npx eas build:configure
npx eas build --profile development --platform ios
```
Install the resulting build on your device once EAS finishes (~10-20 min;
for a physical iOS device this needs your device registered with Apple —
EAS walks you through this on first run). After that, run
`npx expo start --dev-client` and open the project from the installed dev
client app (not Expo Go) each time you develop.

**B. Local build (faster iteration, needs Xcode installed)**
```
npx expo run:ios
```

No third-party map API key needed for either platform — map tiles are
self-hosted, served by `/server` (see `docs/maplibre-migration.md`).

### Android (needs a custom dev client)

**A. EAS Build (cloud, recommended — no local Android SDK needed)**
```
npx eas login                                    # free Expo account
npx eas build:configure
npx eas build --profile development --platform android
```
Download and install the resulting APK on your device once EAS finishes
(~10-20 min). After that, run `npx expo start --dev-client` and open the
project from the installed dev client app (not Expo Go) each time you
develop.

**B. Local build (faster iteration, needs Android Studio/SDK installed)**
```
npx expo run:android
```
Builds and installs directly onto a connected/USB-debugging device.

Either way, the server (`/server`) needs to be running and reachable from
wherever the app runs — see the `EXPO_PUBLIC_API_URL` comments in
`.env.example` for the right host per platform (physical device needs
your computer's LAN IP, not `localhost`).

Pinned to **Expo SDK 54**. Neither platform runs via Expo Go anymore
(Android since Health Connect, iOS since MapLibre — see above), so this
pin is no longer about matching the published Expo Go build; it's just
the usual "upgrade deliberately, not by drift" practice. To bump it, run
`npx expo install --check` after changing `expo` in `package.json` to
realign the rest of the dependencies (or pin manually from
`node_modules/expo/bundledNativeModules.json` if that command can't reach
Expo's API from your network) — and re-pin `react`/`react-native` exactly,
per the note below.

## Notes

- **Android blocks plain `http://` traffic by default in real native
  builds** (unlike Expo Go, which is permissive about this for local
  dev). Since the dev server runs on `http://<LAN-IP>:3000`, not HTTPS,
  API calls fail outright — signup/login show a generic "Request failed"
  error — without `android.usesCleartextTraffic: true` set via
  `expo-build-properties` in `app.config.js`. **Remove this before any
  production release** — the real API should be HTTPS, and this flag
  shouldn't ship.
- **`react`/`react-native` must be pinned to exact versions, no caret.**
  React Native vendors a copy of its renderer built against one exact
  React release; a caret range on `react` lets npm resolve a newer patch
  that satisfies semver but doesn't match what's vendored, causing a
  runtime crash ("Incompatible React versions") that only shows up when
  the app actually launches on-device — `tsc` and Metro bundling both
  stay silent about it. If you ever bump `expo`/`react-native`, re-pin
  `react` and `react-native` to the exact versions in
  `node_modules/expo/bundledNativeModules.json` for that SDK, not a range.
- **Android edge-to-edge**: Android 15+ draws app content behind the
  system status/nav bars by default. Screens use
  `react-native-safe-area-context` (`SafeAreaProvider` in `App.tsx`,
  `useSafeAreaInsets`/`SafeAreaView` in the screens) to pad away from
  them — if you add a new top-level screen, it needs the same treatment
  or its header will render under the status bar.
- **Health Connect on the device**: on Android 14+ it's built into the
  OS; on Android 13 and below the user needs the Health Connect app
  installed from the Play Store separately. Also, Health Connect only has
  step data if *something* is writing it — most phones populate this via
  their built-in system health service, but on a device with nothing
  contributing step data, reads will just come back empty even with
  permission granted correctly. That's a device/OS configuration issue,
  not an app bug.
- **`android.package`** in `app.config.js` is currently the placeholder
  `com.dungeonwalker.app` — change this to a real, owned identifier
  before any Play Store submission; package names can't be changed after
  first publish.
- **Config is `app.config.js`, not `app.json`.** Kept as JS (rather than
  reverting now that the Google Maps API key that originally motivated
  this is gone) since it's a strict superset of `app.json` and other
  config will likely need `process.env` reads again before this project's
  done.
- **Play Store health-permission review**: publishing an app that
  requests Health Connect permissions requires a declaration form in Play
  Console, with review taking up to ~7 days plus ~5-7 more for whitelist
  propagation. Not a blocker for local dev-client testing, but worth
  knowing well before any real release.
- **`plugins/withHealthConnectMainActivity.js`**: a small custom Expo
  config plugin. `expo-health-connect`'s own plugin only adds
  AndroidManifest entries; `react-native-health-connect` also requires
  registering `HealthConnectPermissionDelegate` in `MainActivity.kt`,
  which isn't part of any published plugin, so this project has its own.
  Verified against a real `expo prebuild` run — see the plugin file for
  what it injects.
- **Map rendering**: MapLibre (`@maplibre/maplibre-react-native`) against
  self-hosted Protomaps vector tiles served by `/server`'s
  `GET /tiles/:z/:x/:y.pbf` — no third-party map API key on either
  platform. See `docs/maplibre-migration.md` for the full design and
  `mobile/src/map/style.ts` for how the style is built.
- No 16-bit tile styling yet — `src/map/style.ts` uses
  `@protomaps/basemaps`' stock `LIGHT` flavor to first prove the tile
  pipeline works, and it's missing a `glyphs` URL so map text labels
  don't render yet either (base shapes/roads/water do).
- Session token is a long-lived JWT in `expo-secure-store` with no
  refresh/rotation — matches the current server-side simplification, see
  `server/README.md`.
- Foreground-only step tracking on both platforms — background accrual
  is deferred to its own chunk (see `docs/chunk-3-movement.md`).
- `src/movement/useGameplayState.ts` (formerly `useStepSync`) now owns
  banked AP, the current encounter, and combat actions together, not
  just step syncing — kept in one hook because steps route to either AP
  banking or live encounter damage within the same sync call, so
  splitting it into a separate `useEncounter` would mean two hooks
  fighting over the same interval/timing state.
- No loot/gear or dungeons yet (classes either) — see the root
  `README.md` for the overall build order.
