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
