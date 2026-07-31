# Dungeon Walker

A fitness RPG for iOS and Android. Walking in the real world moves your
character, triggers enemy encounters, and reveals dungeons at real-world
points of interest — think Pokémon Go / Ingress movement mechanics crossed
with a LitRPG dungeon crawler (Dungeon Crawler Carl, Murderbot Diaries,
Project Hail Mary, Ready Player One, The Perfect Run), rendered in a 16-bit
post-apocalyptic style.

## Status

Foundations, movement, and combat core done: project scaffold, account
auth (sign up/log in, one character per account with placeholder stats),
the movement/AP pipeline (steps sync and bank as Activity Points,
avatar-on-map rendering), and combat (random encounters, step/AP-driven
damage, XP/leveling with a small placeholder bestiary). Verified working
end-to-end on a real Android device. Step tracking is platform-split —
iOS via `expo-sensors` (works in Expo Go), Android via Health Connect
(requires a custom dev client, see `mobile/README.md`). Loot/gear,
dungeons, and classes are not implemented yet — see the build-order notes
below.

## Stack

These are starting defaults, not permanent commitments — easy to revisit
before real gameplay code depends on them.

- **Mobile client**: React Native + Expo + TypeScript (`/mobile`)
  Chosen for fastest iteration on a two-person-or-fewer team, and mature
  libraries for maps, location, and step/health data on both platforms.
- **Backend**: Node.js + TypeScript + Postgres via Prisma (`/server`)
  Chosen over a managed BaaS (Firebase/Supabase) because step counts and
  GPS positions must be validated server-side to prevent cheating
  (spoofed location, faked step counts) — that logic needs to live in code
  we control, not a black-box backend.

## Repo layout

```
/mobile   Expo React Native app (iOS + Android client)
/server   Node/TypeScript API (auth, game state, step/location validation)
```

## Build order

The application is being built in vertical slices, roughly in this order:

1. **Foundations** — project scaffold (this), auth, core data model
2. **Movement** — GPS + step tracking pipeline, avatar-on-map rendering,
   Activity Point (banked steps) accrual
3. **Combat core** — random encounters, step-driven + AP-spend damage,
   XP/leveling
4. **Loot & gear** — item drops, inventory, equip effects
5. **Dungeons** — POI-based discovery, multi-floor progression, per-floor
   narrative, boss fights, dungeon-specific loot
6. **Classes** — 10 classes with primary-stat bonuses and abilities
7. **Meta/retention** — social features, notifications, leaderboards,
   multiplayer boss raids (design sketched in `docs/raids-design.md`,
   deliberately not scheduled until the solo loop above is working)

## Design docs

- `docs/chunk-3-movement.md` — movement/AP pipeline implementation plan
- `docs/chunk-4-combat.md` — encounters, step/AP damage routing, XP/leveling plan
- `docs/maplibre-migration.md` — swapping the map layer to MapLibre + OSM tiles (scoped, not yet built)
- `docs/raids-design.md` — multiplayer boss raid concept (later phase)

## Development

See `/mobile/README.md` and `/server/README.md` for setup instructions
specific to each package.
