// Placeholder game-balance constants — tunable, not derived from any
// real design math yet. See docs/chunk-3-movement.md.

// Cap on banked (unspent) Activity Points per character.
export const MAX_BANKED_AP = 5000;

// Steps-per-minute sustained above this is treated as implausible for a
// human on foot and gets flagged (but still credited — see
// docs/chunk-3-movement.md for why we soft-flag instead of rejecting).
export const MAX_PLAUSIBLE_STEPS_PER_MINUTE = 180;

// Meters-per-second implied by GPS movement above this is treated as
// implausible for someone walking/jogging.
export const MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND = 4.5;

// Combat/leveling constants — see docs/chunk-4-combat.md. Flat
// placeholders until the class/gear systems exist to give damage
// formulas something real to scale against.

// Chance, per activity sync with no current encounter, that a new one
// spawns.
export const ENCOUNTER_SPAWN_CHANCE = 0.1;

// How long a spawned-but-unengaged encounter stays available before it
// despawns (distance-based despawn deferred — time-based only for now).
export const ENCOUNTER_PENDING_TTL_MS = 3 * 60 * 1000;

// XP required to reach the next level is BASE * currentLevel (linear).
export const XP_BASE_PER_LEVEL = 100;

// Flat stat increase applied to all six stats per level gained.
export const STAT_GROWTH_PER_LEVEL = 1;
