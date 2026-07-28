# Chunk 3: Movement & Activity Points

Builds the pipeline that converts real-world steps into banked Activity
Points (AP). Encounter spawning and AP spending are chunk 4 — this chunk
only builds the pipe that later chunks will read from and drain.

## Decisions locked in

- **Dungeons/encounters are private per-player instances.** Dungeon
  locations are shared (everyone sees the same POI-based dungeon on the
  map), but a run through one — floor progress, encounters, boss — is
  each player's own. No multiplayer sync, presence, or netcode needed for
  this or the following chunks.
- **Open-world encounters are dismissible**, not mandatory. Since there's
  no player-damage mechanic, forcing engagement would just be a toll
  gate; a player can walk past and it despawns after some distance/time.
- **Banked AP does not decay**, just caps out. No punishment for not
  opening the app.
- **Steps sync to the server in periodic batches**, not a continuous
  stream.

## Server

### Data model additions

`Character.bankedAp` — `Int`, default `0`, capped at `MAX_BANKED_AP` (a
tunable constant, exact value TBD/placeholder — not hardcoded inline in
route logic).

New `ActivitySync` table — an audit log, not just a running counter:

```
id
characterId
stepCount
clientStartedAt
clientEndedAt
serverReceivedAt
latitude?
longitude?
flagged     boolean
flagReason? string
```

An audit trail (vs. just incrementing a counter) is needed for anti-cheat
review, and later for streaks/daily-stats features that need history, not
just a total.

### Endpoint: `POST /activity/sync` (authed)

Request:
```
{ stepCount, clientStartedAt, clientEndedAt, location?: { latitude, longitude } }
```

Server-side:
1. Compute elapsed time between `clientStartedAt`/`clientEndedAt` and the
   implied steps-per-minute. If it exceeds a plausible sustained human
   cadence, or the implied GPS speed (if `location` present) exceeds a
   plausible on-foot pace, mark `flagged: true` with a `flagReason`.
2. **Flagged syncs are still credited.** Hard-rejecting with no review
   tooling yet would punish legit users on false positives (e.g. a bus
   ride between two walks). Soft-flag now; tighten to rejection once
   there's real usage data to calibrate thresholds against.
3. Increment `bankedAp` by `stepCount`, flat 1:1 — no stat scaling yet.
   Stat/ability/gear-driven multipliers land with the class and gear
   systems, consistent with treating combat-balance numbers as
   placeholders for now.
4. Cap at `MAX_BANKED_AP`.
5. Return `{ bankedAp, accepted, flagged }`.

## Mobile

- **Step source: `expo-sensors`' `Pedometer`**, not HealthKit/Health
  Connect directly. It works inside Expo Go, keeping the current testing
  loop (SDK-matched Expo Go on a physical device) intact. HealthKit/Health
  Connect are more authoritative and better for background tracking, but
  require ejecting to a custom EAS dev client — worth doing deliberately
  later (we'll need one eventually anyway, e.g. for the Android Google
  Maps key), not as a side effect of this chunk.
- **Foreground-only tracking for this chunk.** Background step accrual
  needs OS background-task permissions and battery-usage handling — a
  separate, harder problem deserving its own chunk.
- App accumulates a local step delta and syncs on whichever comes first:
  every ~50–100 steps or ~30–60s (placeholder thresholds, tunable).
- `bankedAp` displayed in the `MapScreen` header next to name/level.

## Explicitly deferred

- Exact AP cap, flag thresholds, steps↔AP ratio — placeholder constants.
- Encounter spawning and AP spending (chunk 4).
- Background tracking.
