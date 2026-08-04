# Chunk 4: Combat Core

Random encounters, step/AP-driven damage, and XP/leveling. Builds on
chunk 3's AP pipeline (`docs/chunk-3-movement.md`) — this is where banked
AP and live steps actually get spent. Loot/gear is chunk 5, not this one.

## Decisions locked in

### Step routing during combat

Steps are **routed, not dual-credited**:

- **No active encounter** → steps bank as AP (unchanged from chunk 3).
- **Active encounter** → steps apply as live damage instead of banking.
  AP banked *before* the encounter started remains spendable as an
  instant burst on top.

This follows the original spec's phrasing closely: banked AP is
specifically "steps not yet consumed, accumulated *prior to* the
encounter" — implying steps taken *during* a fight are consumed as
damage, not simultaneously banked as new AP. Dungeons stay dual-purpose
as originally described (steps count toward both floor progress *and*
combat) — that "both" was about progression-vs-combat, not
combat-vs-banking, and is unaffected by this decision.

### Engagement is explicit

An encounter spawns in a dismissible "pending" state — walk past and it
despawns after a timer (placeholder ~2-5 min; distance-based despawn
deferred as unneeded complexity for now). Fighting only starts once the
player taps "Engage." Otherwise, steps taken while just walking near a
spawn could accidentally drain toward a fight the player never meant to
start.

### One encounter at a time

No concurrent pending/active encounters per player for now. Avoids
multi-target step-routing ambiguity and multi-marker spawn/despawn
bookkeeping for a first pass.

### Damage is always server-derived

Same anti-cheat posture as chunk 3: the client never asserts "I dealt N
damage." It either reports steps via the same validated `/activity/sync`
pipeline (extended to check for an active encounter and route
accordingly), or calls a `spend-ap` endpoint that debits the server's own
`bankedAp` value. No new client-trust surface introduced.

### Live damage feedback vs. sync cadence

Found in practice, not planned upfront: the chunk 3 batching decision
(steps sync every 45s to limit server calls) makes combat feel dead —
the vitality bar only moves once per sync, so a player looking at their
device mid-fight sees nothing happen for up to 45 seconds no matter how
much they're actually walking.

Fix has two parts, both mobile-only — nothing about "damage is always
server-derived" above changes, since neither part ever credits real
damage/XP/defeat:

1. **`liveVitality` preview** (`useGameplayState.ts`): while an encounter
   is `ACTIVE`, the client re-reads its own step source locally every
   ~1s (`VITALITY_PREVIEW_INTERVAL_MS`) — a local device query, not a
   network call — and computes `lastKnownServerVitality - stepsSinceLastSync`
   for display. Purely cosmetic: it never itself marks a kill, awards XP,
   or touches `bankedAp`. Re-anchors to the real server values on every
   authoritative sync, so it can't drift further than one sync interval
   before correcting.
2. **Shorter sync cadence during combat only**: while `ACTIVE`, the real
   `/activity/sync` interval drops from 45s to 5s
   (`ACTIVE_ENCOUNTER_POLL_INTERVAL_MS`), reverting to 45s once the
   encounter ends. Bounds how far the local preview can drift, and means
   a real kill (XP/level-up banner) confirms within a few seconds instead
   of lagging up to 45s behind what the bar already showed. Doesn't touch
   the original server-call-reduction goal — it only tightens during the
   (small) fraction of playtime spent mid-fight.

This is the first place the client displays a number before the server
has confirmed it — worth being explicit that it's a deliberate, bounded
exception scoped to *display*, not a weakening of the "server decides
what actually happened" rule.

### Damage formula stays flat

1 step (or 1 AP spent) = 1 damage. No stat scaling yet — matches the AP
conversion rate and the earlier call that combat-balance numbers are
placeholders until the class/gear systems exist to give them something
real to scale against.

### Enemy vitality

Enemies (not the player — there's still no player HP/damage mechanic)
have their own `currentVitality`/`maxVitality`. A small placeholder
bestiary (2-3 generic enemy templates) is enough to prove the mechanic;
real enemy variety is a later content pass.

### XP and leveling

- XP curve: linear placeholder, e.g. `nextLevelXp = base * level`. Exact
  constants TBD like everything else numeric so far.
- Level-up effect: flat +1 to all six stats per level (placeholder), just
  so leveling visibly does something before the class system exists to
  define real growth. Avoids building a stat-allocation UI that would
  likely get replaced once classes land anyway.

## Explicitly deferred

- Loot/gear drops (chunk 5).
- Stat-scaled damage, class abilities.
- Enemy variety/rarity tiers beyond a small placeholder set.
- Distance-based despawn (time-based only for now).
- Concurrent/multiple encounters per player.
