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

**Revised from the original plan below** — the chunk initially shipped
with `expo-sensors`' `Pedometer` on both platforms (kept Expo Go working
everywhere), but on-device testing found it never delivers step events on
Android at all — a known, widely-reported upstream limitation, not a
permission-request bug. Steps were correctly capped at 0 AP no matter how
long the test ran. Fix: split the step source per platform.

- **iOS**: `expo-sensors`' `Pedometer` (`stepSource.ios.ts`), via
  `getStepCountAsync(since, now)`. Still works inside Expo Go.
- **Android**: **Health Connect** (`stepSource.android.ts`), via
  `react-native-health-connect`. Requires a custom dev client — Health
  Connect's native module isn't part of Expo Go's fixed binary. This is
  the tradeoff flagged (but deferred) in the original version of this doc;
  it turned out to be forced sooner than expected because `expo-sensors`
  doesn't work at all on Android, not just less reliably.
- Both platforms share one interface (`stepSource.types.ts`) and are
  picked automatically by Metro (bundling) and TypeScript (via
  `moduleSuffixes` in `tsconfig.json`, so `tsc --noEmit` resolves the
  right file too) based on the `.ios.ts`/`.android.ts` suffix — no
  `Platform.OS` branching needed at the call site.
- **Polling replaced the original watch+threshold design.** Health
  Connect has no live "step taken" event, only range queries
  (`readRecords('Steps', { timeRangeFilter })`, summed over `.count`). To
  keep one code path for both platforms, `useStepSync` now polls
  `getStepCountSince(lastSyncedAt)` on a timer (~45s, placeholder) instead
  of the earlier per-step-threshold trigger.
- **Foreground-only tracking for this chunk.** Background step accrual
  needs OS background-task permissions and battery-usage handling — a
  separate, harder problem deserving its own chunk.
- `bankedAp` displayed in the `MapScreen` header next to name/level, along
  with a `pedometerStatus` (`checking`/`unavailable`/`permission-denied`/
  `active`) so a broken step source is visible in the UI instead of
  silently sitting at 0 AP.
- A small custom Expo config plugin
  (`mobile/plugins/withHealthConnectMainActivity.js`) registers
  `HealthConnectPermissionDelegate` in `MainActivity.kt` during
  `expo prebuild` — required by `react-native-health-connect` but not
  handled by `expo-health-connect`'s own plugin (which only adds
  AndroidManifest entries). Verified against a real prebuild run.

## Explicitly deferred

- Exact AP cap, flag thresholds, steps↔AP ratio — placeholder constants.
- Encounter spawning and AP spending (chunk 4).
- Background tracking.
