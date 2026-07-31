# Map rendering migration: react-native-maps → MapLibre

Swaps the map layer from Google/Apple Maps to MapLibre + OSM-derived
vector tiles. Two motivations converge on the same solution: reducing
map API costs, and getting real control over the map's visual style
toward the game's 16-bit look — see the chat discussion this doc follows
up on for the full reasoning.

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

### Tile data source: free-tier hosted provider for now

Real options, roughly in order of setup cost:

1. **Free-tier hosted (MapTiler Cloud or Stadia Maps)** — an API key +
   a style URL, no infrastructure to run. Free tier caps out around
   ~100k tile loads/month depending on provider, which is generous for a
   prototype with a handful of testers.
2. **Self-hosted via Protomaps** — a static `.pmtiles` file (a regional
   or planet extract) served from any static storage/CDN via HTTP range
   requests, no tile server process needed. Very cheap at any real scale,
   but adds a data-extraction/update workflow to own.
3. **Full self-hosted tile server** (e.g. `tileserver-gl` + OpenMapTiles
   data as a service alongside `/server`) — most control, most ops
   burden (a stateful service, tile data storage).

**Recommendation: start with option 1.** Matches the project's existing
pattern of shipping the cheapest workable placeholder now and revisiting
under real load (soft-flagged anti-cheat, flat damage formulas, etc.) —
same logic applies here. Move to Protomaps (option 2) if/when usage
approaches the free tier limit; that's a data-hosting change, not another
library swap, so it doesn't require touching `MapScreen.tsx` again.

### Style: iterate, don't block on it

Start from an existing open base style (MapTiler/Stadia ship free ones —
e.g. a "basic" or "positron" style) and reskin toward a 16-bit palette
incrementally — recolor terrain/roads, hide clutter layers, swap POI
icons. This is open-ended design work, not a blocker to shipping the
library swap itself.

### Overlay architecture

- **`SymbolLayer`** (GPU-rendered) for markers that will exist in
  quantity later — dungeon POIs, encounter spawns, once those are
  geo-located (see "Explicitly out of scope" below).
- **`PointAnnotation`** (a real React Native view anchored to a
  coordinate) for the player avatar — needs more custom
  interactivity/animation than a static icon.

This is the idiomatic MapLibre approach — do not hand-roll a separate
absolutely-positioned overlay view manually synced to map pan/zoom.

### Full replace, not parallel

Remove `react-native-maps` and all the Google Maps API key plumbing
entirely once MapLibre is confirmed working, rather than keeping both
installed. No reason to maintain two map implementations at a prototype
stage.

## What actually changes

**Removed:**
- `react-native-maps` dependency
- `ANDROID_GOOGLE_MAPS_API_KEY` env var, its `app.config.js`
  `android.config.googleMaps` block, and the related README setup
  instructions/warnings
- The Google Cloud Console API key setup steps in `mobile/README.md`

**Added:**
- `@maplibre/maplibre-react-native` + its Expo config plugin
- A style URL env var (name TBD on provider choice, e.g.
  `MAPLIBRE_STYLE_URL` or `MAPTILER_API_KEY` depending on how the chosen
  provider issues access) in `mobile/.env.example`
- Rewritten map rendering in `src/screens/MapScreen.tsx`: MapLibre's
  `MapView`/`Camera` for the base map + user-following, `PointAnnotation`
  for the avatar marker (replaces `react-native-maps`' `MapView`/`Marker`)

**Unaffected:** the server has zero map-provider dependency. Auth,
movement/AP, and combat/encounters are already fully decoupled from map
rendering — this migration only touches one screen's rendering code.

## Explicitly out of scope for this migration

- **Encounters don't currently have coordinates.** The `Encounter` model
  has no `latitude`/`longitude` — encounters are per-character abstract
  state shown as a UI card, not placed on the map. Giving encounters (and
  future dungeons) real map positions and rendering them via
  `SymbolLayer` is a natural follow-up, but a separate, later change —
  not bundled into this one.
- Custom 16-bit style JSON — iterative, starts from a stock style.
- Self-hosted tiles (Protomaps or otherwise) — revisit if/when the free
  tier stops being enough.

## Verification plan

Same division of labor as previous chunks: typecheck, both-platform
Metro bundle checks, and a real `expo prebuild` dry-run to confirm the
MapLibre config plugin applies correctly (mirrors how the Health Connect
and Google Maps key plugins were verified) all happen without a device.
Actually seeing the map render correctly needs a real on-device build,
same as every native-layer change so far — that verification step is
yours once it's implemented.
