# Dungeon Walker — Mobile

Expo (React Native + TypeScript) client for iOS and Android.

## Current state

Sign up / log in against the server, then a map screen: requests
foreground location permission, renders a map centered on the device's
live position with a placeholder marker for the player avatar, and shows
the signed-in character's name/level plus banked Activity Points (AP) in
the header, with a log-out button. Steps counted via the device
pedometer sync to the server in the background and bank as AP. No
encounters/combat/dungeons yet.

## Setup

```
npm install
cp .env.example .env   # point EXPO_PUBLIC_API_URL at your running server, see comments in the file
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` to launch
a simulator/emulator (requires Xcode / Android Studio respectively). The
server (`/server`) needs to be running and reachable from wherever the
app runs — see the `EXPO_PUBLIC_API_URL` comments in `.env.example` for
the right host per platform (physical device needs your computer's LAN
IP, not `localhost`).

Pinned to **Expo SDK 54** to match whatever the Expo Go app on the App
Store / Play Store currently supports — Expo Go only runs one SDK version
at a time, so a project ahead of the published Expo Go build fails to load
with a "failed to download remote update" error. If Expo Go moves to a
newer SDK, bump `expo` and run `npx expo install --check` to realign the
rest of the dependencies (or pin manually from
`node_modules/expo/bundledNativeModules.json` if that command can't reach
Expo's API from your network).

## Notes

- **Android edge-to-edge**: Android 15+ draws app content behind the
  system status/nav bars by default. Screens use
  `react-native-safe-area-context` (`SafeAreaProvider` in `App.tsx`,
  `useSafeAreaInsets`/`SafeAreaView` in the screens) to pad away from
  them — if you add a new top-level screen, it needs the same treatment
  or its header will render under the status bar.
- **Android step permission**: the step counter sensor requires the
  `ACTIVITY_RECOGNITION` runtime permission, requested via
  `Pedometer.requestPermissionsAsync()` in `useStepSync`. Declaring it in
  `app.json`'s `android.permissions` isn't enough by itself — without the
  runtime request, the sensor silently delivers no events instead of
  erroring, which looks like "steps just aren't accruing."

## Known gaps before this is a real build

- **Android maps**: `react-native-maps` needs a Google Maps API key on
  Android. Add it under `expo.android.config.googleMaps.apiKey` in
  `app.json` before building for Android (iOS uses Apple Maps by default,
  no key needed).
- No 16-bit tile styling yet — this spike uses the default map style to
  first prove the location → map pipeline works.
- Session token is a long-lived JWT in `expo-secure-store` with no
  refresh/rotation — matches the current server-side simplification, see
  `server/README.md`.
- Step tracking uses `expo-sensors`' `Pedometer`, which works inside Expo
  Go (no custom dev client needed) but is foreground-only — steps stop
  counting once the app is backgrounded. Background tracking, and
  possibly moving to HealthKit/Health Connect for more authoritative
  data, is deferred to its own chunk (see `docs/chunk-3-movement.md`).
- No gameplay yet (encounters, combat, dungeons, classes) — see the root
  `README.md` for the overall build order.
