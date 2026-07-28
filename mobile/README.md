# Dungeon Walker — Mobile

Expo (React Native + TypeScript) client for iOS and Android.

## Current state

Location + map spike only: requests foreground location permission, then
renders a map centered on the device's live position with a placeholder
marker for the player avatar. No game logic yet.

## Setup

```
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` to launch
a simulator/emulator (requires Xcode / Android Studio respectively).

## Known gaps before this is a real build

- **Android maps**: `react-native-maps` needs a Google Maps API key on
  Android. Add it under `expo.android.config.googleMaps.apiKey` in
  `app.json` before building for Android (iOS uses Apple Maps by default,
  no key needed).
- No 16-bit tile styling yet — this spike uses the default map style to
  first prove the location → map pipeline works.
- No auth, no character, no gameplay — see the root `README.md` for the
  overall build order.
