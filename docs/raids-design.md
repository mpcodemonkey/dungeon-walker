# Multiplayer Boss Raids (design notes, not yet scheduled)

Captured for later — **do not build yet**. Priority is the solo core loop
(chunks 3-6: movement/AP, combat, loot, dungeons, classes) first. Nothing
in that plan blocks adding this afterward; raids are a separate system,
not a modification of the private per-player dungeon model.

## Why this needs its own model

Regular dungeons are private per-player instances (see
`chunk-3-movement.md`). Raids are deliberately the one place in the game
with shared, multiplayer state: a boss with a single HP pool that
multiple players contribute to.

Pokémon Go's raid model (short synchronous window, everyone physically
present, fast tap-combat) doesn't transfer directly: here, "combat" is
walking, which takes real wall-clock time. Requiring a group to physically
co-locate and walk together for the time it'd take to burn down a
meaningful shared HP pool is a much bigger ask than a 5-minute tap battle,
and would likely mean most raids just don't happen.

## Core model

- **Long, asynchronous window.** A raid boss is "up" for an extended
  period (hours, maybe a day+), not a tight time-boxed window. Different
  players can contribute at different times without needing to overlap.
- **Discovery requires proximity.** At least one player has to physically
  get close to the boss's real-world location to discover it — same
  "go there" premise as dungeon POIs. Discovering it reveals/generates a
  shareable **raid code**.
- **Remote participation via raid code, free.** Anyone with the code can
  join the raid from anywhere — no location check, no paywall (explicit
  differentiator from Pokémon Go's paid remote raid passes).
- **Contribution split by presence:**
  - **In-person** (physically near the boss location): can contribute
    via live steps *or* banked AP, same as a regular encounter.
  - **Remote** (joined via code, not near the location): **AP only.**
    No live-step contribution remotely.

## Why AP-only for remote matters (cheap, effective anti-cheat)

This single rule does most of the anti-cheat work for free, without
needing a more robust cheat-detection system:

- Thematically clean: spending banked AP remotely reads as "channeling
  stored effort at a distant target"; live-step damage implies actually
  being there swinging at it.
- Nothing to fake or verify: a remote participant isn't claiming to be
  anywhere, so there's no location claim to spoof. They can only spend a
  resource (AP) that was already earned through real, previously-verified
  exertion elsewhere.
- Reuses an existing mechanic (AP spend against a target) rather than
  inventing a new one.

## Open questions (design later, not blocking)

- **In-person incentive.** If remote is fully free and equally effective,
  does that hollow out the incentive to physically show up (beyond
  whoever discovers it)? Options to consider: a small in-person
  efficiency edge (not a wall — just modestly more effective per unit of
  effort), and/or a first-finder bonus reward for whoever discovers the
  raid, to keep rewarding exploration specifically.
- **Code hygiene.** Needs enough entropy to resist brute-force/scraping,
  and probably an expiry tied to the raid's own window.
- **Participant caps / reward scaling.** More contributors (especially
  remote ones recruited after the fact) could trivialize a boss's
  intended difficulty. Reward share likely needs to scale down as more
  people pile on, so "just recruit an army remotely" isn't strictly
  better than solving it with people who actually showed up.
- **No-kill outcome.** Leaning toward "no kill, no reward" (maybe a
  weaker respawn carrying over remaining HP) to preserve incentive to
  actually coordinate a finish before the window closes, rather than
  trickling in contributions indefinitely.
- Whether raid bosses live at their own dedicated location type, or reuse
  the same POI pool as dungeons with a "can become a raid" flag.

## Explicit non-goals for this feature

- Real-time netcode / websockets — the async, presence-gated model above
  doesn't need it; periodic polling of shared boss HP is enough for the
  "watch it drop" feel.
- Any interaction with the private-dungeon system — raids are additive,
  not a special case of dungeons.
