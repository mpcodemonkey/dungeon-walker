# Dungeon Walker — Server

Node.js + TypeScript API. Handles auth, persistent game state, and
server-side validation of step counts / GPS positions (kept server-side
deliberately, since this is the primary anti-cheat surface for the game).

## Current state

Auth + core data model (email/password accounts, one character per
account with the six placeholder stats, JWT sessions) plus the movement
pipeline: the mobile app's step counts sync here and bank as Activity
Points (AP). No encounters/combat/dungeons yet — see
`docs/chunk-3-movement.md` at the repo root for the full design.

## Setup

```
npm install
cp .env.example .env   # then point DATABASE_URL at a real Postgres instance, set JWT_SECRET
npx prisma migrate dev
npm run dev
```

`GET /health` should respond `{"status":"ok"}`.

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
  `{ bankedAp, accepted, flagged }`.

## Notes

- Prisma is pinned to v6 rather than the current v7 line — v7 moved to a
  driver-adapter model (`prisma.config.ts` + `@prisma/adapter-pg`) that
  adds setup complexity not worth taking on before the data layer is
  actually being designed. Worth revisiting once schema/migrations work
  starts in earnest.
- Character stats (`strength`/`agility`/`focus`/`intelligence`/`wisdom`/
  `luck`) start at a flat placeholder value (5) — real starting spreads
  depend on the class system and combat balancing, not yet built.
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
