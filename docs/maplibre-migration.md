# Map rendering migration: react-native-maps → MapLibre

**Status: implemented.** Swaps the map layer from Google/Apple Maps to
MapLibre + OSM-derived vector tiles. Two motivations converge on the same
solution: reducing map API costs, and getting real control over the
map's visual style toward the game's 16-bit look — see the chat
discussion this doc follows up on for the full reasoning.

This is infrastructure, not a numbered build-order chunk — it touches
only how the map renders, not gameplay. Filed alongside the chunk docs
since it follows the same discuss-then-scope pattern.

## Why not just add OSM tiles to react-native-maps

Tried the obvious shortcut first: overlay OSM tiles on the existing
`react-native-maps` setup via its `UrlTile` component, keep everything
else. Doesn't work — `react-native-maps` on Android is built directly on
the Google Maps SDK and requires the API key regardless of what tiles
render on top of it (confirmed via the
[react-native-maps issue tracker](https://github.com/react-native-maps/react-native-maps/issues/5156)).
A real swap means replacing the library, not just the tile source.

## Decisions locked in

### Library: MapLibre React Native

[`@maplibre/maplibre-react-native`](https://github.com/maplibre/maplibre-react-native) —
open-source fork of the pre-proprietary Mapbox SDK, official Expo
support, renders vector tiles itself with no Google/Apple SDK
underneath. Works with any vector tile source.

### Tile data source: Protomaps, self-hosted from the start

A `.pmtiles` file (a regional extract, or the planet if ever needed) —
built or downloaded via Protomaps' open-source tooling from OSM data.

**Storage: the server's own local disk for now**, not cloud object
storage. A regional extract is a manageable file size, we're already
running our own server, and this avoids standing up a new external
dependency (an R2/S3 account + credentials) before there's a real reason
to. Move to object storage (R2 is the natural fit if/when it's needed:
zero egress fees, and `.pmtiles`' whole design is built around serving
from plain HTTP range requests) once the file size or deployment model
calls for it — e.g. a stateless/serverless server deployment, or
multi-region hosting.

**How the app actually reads it matters — don't point MapLibre straight
at the file.** MapLibre *Native* (the underlying iOS/Android engine)
supports reading `.pmtiles` directly via a `pmtiles://` source. But the
React Native wrapper we're using, `@maplibre/maplibre-react-native`, has
an [open, unresolved issue](https://github.com/maplibre/maplibre-react-native/issues/28)
about not exposing custom protocol support the way the web/JS SDK does —
so "no server at all" isn't a confirmed-working path in the RN wrapper
specifically, as of writing. There's also a known mobile-specific
pitfall: native MapLibre doesn't auto-handle gzip like browsers do, so a
misconfigured `.pmtiles` server can serve compressed tiles the client
silently fails to render.

**Fix: a small tile-proxy endpoint on our own `/server`** —
`GET /tiles/:z/:x/:y.pbf`, using the `pmtiles` npm package to read the
requested tile's byte range out of the local `.pmtiles` file and serve it
as a plain vector tile with the right headers. This uses the
universally-supported standard tile URL-template style (works
unambiguously in both MapLibre Native and the RN wrapper), sidesteps the
protocol-support uncertainty, and doesn't add a new running service —
just a couple more routes on the Express server we already run. Worth
re-checking the linked issue at implementation time; if it's been
resolved by then, pointing at `.pmtiles` directly becomes a valid
simplification, but the proxy is the safe default now.

### Style: iterate, don't block on it

Start from [`@protomaps/basemaps`](https://github.com/protomaps/basemaps)
(the open-source style/theme package built for exactly this data source —
published under this name; its predecessor `protomaps-themes-base` is
deprecated) and reskin toward a 16-bit palette incrementally — recolor
terrain/roads, hide clutter layers, swap POI icons. This is open-ended
design work, not a blocker to shipping the library swap itself.

Implemented in `mobile/src/map/style.ts`: `layers('protomaps', LIGHT)`
combined with a manually-built `sources.protomaps` vector source pointing
at our tile-proxy. No `glyphs` URL yet, so the symbol layers this returns
won't render text — base shapes (roads, water, land cover) render fine.
Adding real text labels is a follow-up, not done here.

### Overlay architecture

- **`SymbolLayer`** (GPU-rendered) for markers that will exist in
  quantity later — dungeon POIs, encounter spawns, once those are
  geo-located (see "Explicitly out of scope" below).
- **`Marker`** (a real React Native view anchored to a coordinate) for
  the player avatar — needs more custom interactivity/animation than a
  static icon. (This doc originally called this "PointAnnotation," going
  on the older Mapbox-derived API shape from general knowledge —
  `@maplibre/maplibre-react-native`'s actual v11 API, confirmed by
  reading its shipped `.d.ts` files, names this component `Marker`
  instead. Same role, different name.)

This is the idiomatic MapLibre approach — do not hand-roll a separate
absolutely-positioned overlay view manually synced to map pan/zoom.

### Full replace, not parallel

Remove `react-native-maps` and all the Google Maps API key plumbing
entirely once MapLibre is confirmed working, rather than keeping both
installed. No reason to maintain two map implementations at a prototype
stage.

### iOS also needs a custom dev client now

Not part of the original plan — found while verifying `expo prebuild`.
Android already required a custom dev client (Health Connect), but iOS
had stayed on Expo Go so far because Apple Maps via `react-native-maps`
ships inside Expo Go's fixed binary. MapLibre is a third-party native
module the same way Health Connect is, so it isn't in Expo Go either —
iOS now needs the same dev-client build flow Android already uses. See
`mobile/README.md`'s updated iOS setup section.

## What actually changes

**Removed:**
- `react-native-maps` dependency
- `ANDROID_GOOGLE_MAPS_API_KEY` env var, its `app.config.js`
  `android.config.googleMaps` block, and the related README setup
  instructions/warnings
- The Google Cloud Console API key setup steps in `mobile/README.md`

**Added — mobile:**
- `@maplibre/maplibre-react-native` + its Expo config plugin,
  `@protomaps/basemaps` for the base style
- `mobile/.env.example` points the map style/tile URLs at our own
  `/server` (no third-party map API key at all now — the whole point)
- `mobile/src/map/style.ts` builds the `StyleSpecification` (protomaps
  vector source at our tile-proxy URL + `@protomaps/basemaps`' layers)
- Rewritten map rendering in `src/screens/MapScreen.tsx`: MapLibre's
  `Map`/`Camera` for the base map + user-following (camera recentered via
  `CameraRef.easeTo()` as location updates), `Marker` for the avatar
  (replaces `react-native-maps`' `MapView`/`Marker`)
- `ios.bundleIdentifier` in `app.config.js` — previously unset since iOS
  never left Expo Go; needed now that iOS also prebuilds (see below)

**Added — server** (this migration does touch `/server`, unlike earlier
chunks which were mobile-only map work):
- `GET /tiles/:z/:x/:y.pbf` — reads the requested tile from the local
  `.pmtiles` file via the `pmtiles` npm package, serves it with correct
  headers. No auth needed — map tiles aren't player-specific data.
- A one-time/occasional process for building or downloading the
  `.pmtiles` extract itself onto the server's disk — not part of the
  request path, doesn't need to live in the Express app.

**Unaffected:** auth, movement/AP, and combat/encounters — already fully
decoupled from map rendering.

## Explicitly out of scope for this migration

- **Encounters don't currently have coordinates.** The `Encounter` model
  has no `latitude`/`longitude` — encounters are per-character abstract
  state shown as a UI card, not placed on the map. Giving encounters (and
  future dungeons) real map positions and rendering them via
  `SymbolLayer` is a natural follow-up, but a separate, later change —
  not bundled into this one.
- Custom 16-bit style JSON — iterative, starts from the stock
  `protomaps-themes-base` style.

## Verification

Same division of labor as previous chunks — all done, except the on-device
visual check:

- **Server**: the `/tiles/:z/:x/:y.pbf` endpoint tested end to end against
  a real `.pmtiles` fixture (`server/test-fixtures/pmtiles/`) — a valid
  tile returns decompressed protobuf bytes (confirmed at the byte level,
  not just status code), a tile outside the archive returns `204`,
  malformed coordinates return `400`, and a missing/unconfigured
  `.pmtiles` file returns a graceful `500` without crashing the server.
- **Mobile**: `tsc --noEmit` clean; `expo prebuild` run for real for both
  `--platform android` and `--platform ios` (confirmed the MapLibre
  plugin lands correctly — no leftover Google Maps API key manifest
  entries on Android, MapLibre's post-install block present in the iOS
  `Podfile`); `expo export` (Metro bundle, not just a dry bundle) succeeds
  for both platforms. Generated `android/`/`ios/` dirs aren't committed
  (gitignored, same as before this migration) — removed after verifying.

Actually seeing the map render correctly on a device is still yours to
check — that's the one thing that can't be verified without real
hardware, same as every native-layer change so far.
