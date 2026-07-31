# Dungeon Walker — Mobile

Expo (React Native + TypeScript) client for iOS and Android.

## Current state

Sign up / log in against the server, then a map screen: requests
foreground location permission, renders a map centered on the device's
live position with a placeholder marker for the player avatar, and shows
the signed-in character's name/level plus banked Activity Points (AP) in
the header, with a log-out button. Steps sync to the server periodically
and bank as AP. No encounters/combat/dungeons yet.

Step tracking is platform-split (`src/movement/stepSource.ios.ts` /
`stepSource.android.ts`, picked automatically by Metro/TypeScript based on
the file suffix):

- **iOS**: `expo-sensors`' `Pedometer` (CMPedometer). Works inside Expo Go.
- **Android**: **Health Connect**, via `react-native-health-connect`.
  `expo-sensors`' Pedometer on Android is unreliable — multiple open
  upstream issues report permission resolving but step events never
  firing. Health Connect is Android's standard fitness-data store instead.

**This means Android testing needs a custom dev client, not Expo Go.**
Health Connect's native module isn't part of Expo Go's fixed binary, so
Metro will bundle fine but the app will fail on-device unless it's a build
that actually includes this native module. iOS is unaffected and still
works in plain Expo Go.

## Setup

```
npm install
cp .env.example .env   # point EXPO_PUBLIC_API_URL at your running server, see comments in the file
```

### iOS (still works via Expo Go)

```
npx expo start
```

Scan the QR code with Expo Go, or press `i` to launch the simulator
(requires Xcode).

### Android (needs a custom dev client)

First, get a Google Maps API key (required — `react-native-maps` won't
render without one, and the app fails at launch with a clear "API key not
found" screen if it's missing):

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select
   a project, then enable the **"Maps SDK for Android"** API.
2. Create an API key under **APIs & Services → Credentials**.
3. Recommended: restrict the key to Android apps, with package name
   `com.dungeonwalker.app` (see `app.config.js`) and your build's SHA-1
   signing fingerprint (EAS shows this in its build output; for a local
   debug build, `keytool -list -v -keystore ~/.android/debug.keystore`
   with password `android`).

Then set `ANDROID_GOOGLE_MAPS_API_KEY` (see `.env.example`):

- **Local builds**: add it to `mobile/.env` (already gitignored).
- **EAS cloud builds**: `.env` isn't available inside EAS's cloud build
  environment, so set it there directly, e.g.
  `npx eas env:create --name ANDROID_GOOGLE_MAPS_API_KEY --value <your-key> --environment development`
  (or via the EAS dashboard).

Then pick one build path:

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

Pinned to **Expo SDK 54** to match whatever the Expo Go app on the App
Store / Play Store currently supports (this only matters for iOS's Expo Go
path now — Android no longer runs via Expo Go at all). Expo Go only runs
one SDK version at a time, so a project ahead of the published Expo Go
build fails to load with a "failed to download remote update" error. If
Expo Go moves to a newer SDK, bump `expo` and run `npx expo install
--check` to realign the rest of the dependencies (or pin manually from
`node_modules/expo/bundledNativeModules.json` if that command can't reach
Expo's API from your network).

## Notes

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
- **Config is `app.config.js`, not `app.json`.** Switched so the Google
  Maps API key can be read from an environment variable
  (`ANDROID_GOOGLE_MAPS_API_KEY`) instead of being committed in plain
  text — logs a clear warning at config-resolution time if it's missing
  rather than failing silently until the app launches on-device.
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
- **Android maps**: `react-native-maps` needs a Google Maps API key on
  Android — see the "Android (needs a custom dev client)" setup section
  above (iOS uses Apple Maps by default, no key needed).
- No 16-bit tile styling yet — the map spike uses the default style to
  first prove the location → map pipeline works.
- Session token is a long-lived JWT in `expo-secure-store` with no
  refresh/rotation — matches the current server-side simplification, see
  `server/README.md`.
- Foreground-only step tracking on both platforms — background accrual
  is deferred to its own chunk (see `docs/chunk-3-movement.md`).
- No gameplay yet (encounters, combat, dungeons, classes) — see the root
  `README.md` for the overall build order.
