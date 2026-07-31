# Dungeon Walker — Server

Node.js + TypeScript API. Handles auth, persistent game state, and
server-side validation of step counts / GPS positions (kept server-side
deliberately, since this is the primary anti-cheat surface for the game).

## Current state

Auth + core data model (email/password accounts, one character per
account with the six placeholder stats, JWT sessions), the movement
pipeline (steps sync and bank as Activity Points), and combat core:
random encounters, step/AP-driven damage, and XP/leveling. No loot/gear
or dungeons yet — see `docs/chunk-3-movement.md` and
`docs/chunk-4-combat.md` at the repo root for the full design.

## Setup

```
npm install
cp .env.example .env   # then set JWT_SECRET and point DATABASE_URL at Postgres, see below
npx prisma migrate dev   # creates tables + Prisma client
npm run db:seed          # seeds the placeholder bestiary (Enemy table) — needed for encounters to spawn
npm run dev
```

`GET /health` should respond `{"status":"ok"}`.

### Getting a Postgres instance

Pick one, depending on what's already on your machine:

**Docker:**
```
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=dungeon_walker postgres:16
```
`DATABASE_URL="postgresql://postgres:password@localhost:5432/dungeon_walker?schema=public"`

**Native Postgres install:**
```
psql postgres -c "CREATE USER dungeon_walker WITH PASSWORD 'dungeon_walker';"
psql postgres -c "CREATE DATABASE dungeon_walker OWNER dungeon_walker;"
psql postgres -c "ALTER USER dungeon_walker CREATEDB;"   # lets `prisma migrate dev` create its shadow DB
```
`DATABASE_URL="postgresql://dungeon_walker:dungeon_walker@localhost:5432/dungeon_walker?schema=public"`

## Auth endpoints

- `POST /auth/signup` — body `{ email, password, characterName }`, creates
  a user + their character, returns `{ token, user, character }`
- `POST /auth/login` — body `{ email, password }`, returns
  `{ token, user, character }`
- `GET /me` — requires `Authorization: Bearer <token>`, returns
  `{ user, character }`

Passwords are hashed with bcrypt; tokens are signed JWTs read from
`JWT_SECRET`. Access tokens are long-lived (30 days) with no refresh-token
rotation or revocation yet — fine for a prototype single-device flow, but
worth hardening (short-lived access token + rotating refresh token, or a
server-side session/blocklist for revocation) before this handles real
user accounts.

## Activity endpoint

- `POST /activity/sync` — requires `Authorization: Bearer <token>`.
  Body: `{ stepCount, clientStartedAt, clientEndedAt, location? }`.
  Credits `stepCount` to the character's `bankedAp` (flat 1:1, capped at
  `MAX_BANKED_AP` in `src/lib/constants.ts`), and persists an
  `ActivitySync` audit row. Implausible step cadence or GPS-implied speed
  gets `flagged: true` in the response and in the stored row, but is
  **still credited** — see `docs/chunk-3-movement.md` for why syncs are
  soft-flagged rather than rejected at this stage. Returns
  `{ bankedAp, accepted, flagged, encounter, combat }` — see Encounters
  below for what `encounter`/`combat` carry.

## Encounters (combat core)

See `docs/chunk-4-combat.md` for the full design. Summary: encounters are
private per-character (never shared/multiplayer — see
`docs/chunk-3-movement.md`), one pending/active at a time, and damage is
always server-derived — the client never asserts "I dealt N damage."

- **Spawning** happens inside `/activity/sync`: if a character has no
  current encounter, each sync rolls `ENCOUNTER_SPAWN_CHANCE` to maybe
  create one (`PENDING`, random enemy from the seeded bestiary, expires
  after `ENCOUNTER_PENDING_TTL_MS` if never engaged).
- **Step routing**: while a character has an `ACTIVE` encounter, synced
  steps apply as damage to it instead of banking as AP. With no active
  encounter (including while one is merely `PENDING`, unengaged), steps
  bank as AP as usual.
- `GET /encounters/current` — requires auth. Returns
  `{ encounter: Encounter | null }`. Lazily expires a stale `PENDING`
  encounter (past `expiresAt`) to `DESPAWNED` before responding.
- `POST /encounters/:id/engage` — requires auth, encounter must be owned,
  `PENDING`, and not expired. Transitions to `ACTIVE`; from this point
  synced steps damage it instead of banking.
- `POST /encounters/:id/dismiss` — requires auth, encounter must be owned
  and `PENDING`. Transitions to `DESPAWNED`.
- `POST /encounters/:id/spend-ap` — requires auth, encounter must be
  owned and `ACTIVE`. Body `{ amount }`; debits `min(amount, bankedAp)`
  from the character and applies it as an instant damage burst. Returns
  `{ encounter, defeated, xpAwarded, levelsGained, bankedAp }`.
- On defeat (vitality reaches 0, via either path), the character is
  awarded the enemy's `xpReward` and any level-ups (linear curve, flat
  +1 to all six stats per level — placeholders, see
  `docs/chunk-4-combat.md`) in the same transaction as resolving the
  encounter to `DEFEATED`.

## Notes

- Prisma is pinned to v6 rather than the current v7 line — v7 moved to a
  driver-adapter model (`prisma.config.ts` + `@prisma/adapter-pg`) that
  adds setup complexity not worth taking on before the data layer is
  actually being designed. Worth revisiting once schema/migrations work
  starts in earnest.
- Character stats (`strength`/`agility`/`focus`/`intelligence`/`wisdom`/
  `luck`) start at a flat placeholder value (5) — real starting spreads
  depend on the class system and combat balancing, not yet built.
- The bestiary (`Enemy` table) is 3 placeholder entries from
  `prisma/seed.ts` — real enemy variety is a later content pass, not a
  system limitation. Run `npm run db:seed` after a fresh migration or
  encounters have nothing to spawn.
- `spend-ap` doesn't refund overkill — spending more AP than an
  encounter's remaining vitality just kills it with the excess wasted,
  no partial-refund bookkeeping. Simplest behavior for a placeholder;
  worth revisiting if it feels bad in practice.
- No player HP/damage: enemies never deal damage back. The player defeats
  enemies purely through exercise (steps, banked AP) — there's no
  mechanic by which the player takes damage or can "lose" a fight, only
  ways to defeat it faster or slower.
- Plausibility checks in `/activity/sync` trust the client-reported
  `clientStartedAt`/`clientEndedAt` timestamps for rate calculations —
  a client could lie about elapsed time to lower its apparent
  steps-per-minute. Acceptable for now given syncs are soft-flagged, not
  rejected, but worth revisiting (e.g. anchoring against
  `serverReceivedAt` deltas across syncs) before this matters for anti-cheat.
