import { useEffect, useRef, useState } from 'react';
import {
  syncActivity,
  fetchCurrentEncounter,
  engageEncounter,
  dismissEncounter,
  spendApOnEncounter,
  type Encounter,
} from '../api/client';
import { stepSource } from './stepSource';
import type { PedometerStatus } from './stepSource.types';

export type { PedometerStatus };

// Placeholder — tunable. See docs/chunk-3-movement.md.
const POLL_INTERVAL_MS = 45_000;

// Much shorter sync cadence while an encounter is ACTIVE, so real
// defeat/XP/level-up confirmations (and the liveVitality reconciliation
// below) don't lag up to a full POLL_INTERVAL_MS behind what the player
// is already seeing. Only kicks in during a fight, not general walking —
// see docs/chunk-4-combat.md, "Live damage feedback vs. sync cadence."
const ACTIVE_ENCOUNTER_POLL_INTERVAL_MS = 5_000;

// How often to locally re-read the step source for the optimistic
// liveVitality preview during combat. A local device read, not a
// network call — cheap enough to poll much faster than the real sync.
const VITALITY_PREVIEW_INTERVAL_MS = 1_000;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GameplayState {
  bankedAp: number;
  level: number;
  pedometerStatus: PedometerStatus;
  encounter: Encounter | null;
  // Locally-predicted vitality while an encounter is ACTIVE, updated every
  // VITALITY_PREVIEW_INTERVAL_MS from steps the device has already
  // recorded but the server hasn't confirmed yet — purely cosmetic, so the
  // vitality bar visibly drops on every step instead of jumping once per
  // sync. Never itself credits damage/XP/defeat; undefined outside combat
  // or before the first local read completes, in which case callers
  // should fall back to encounter.currentVitality.
  liveVitality: number | undefined;
  combatMessage: string | undefined;
  engage: () => Promise<void>;
  dismiss: () => Promise<void>;
  spendAp: (amount: number) => Promise<void>;
}

// Owns everything driven by the activity-sync loop: banked AP, the
// current encounter, and combat actions. Kept in one hook rather than
// split (e.g. a separate useEncounter) because steps route to either AP
// banking or live encounter damage within the same sync call — splitting
// them would mean two hooks fighting over the same interval/timing state.
// Foreground-only (see docs/chunk-3-movement.md — background accrual is
// a separate, harder problem deferred to its own chunk).
export function useGameplayState(
  token: string,
  initialBankedAp: number,
  initialLevel: number,
  location: Coordinates | undefined
): GameplayState {
  const [bankedAp, setBankedAp] = useState(initialBankedAp);
  const [level, setLevel] = useState(initialLevel);
  const [pedometerStatus, setPedometerStatus] = useState<PedometerStatus>('checking');
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [liveVitality, setLiveVitality] = useState<number | undefined>();
  const [combatMessage, setCombatMessage] = useState<string | undefined>();

  const lastSyncedAtRef = useRef(new Date());
  const locationRef = useRef(location);
  const encounterRef = useRef<Encounter | null>(null);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  function updateEncounter(next: Encounter | null) {
    encounterRef.current = next;
    setEncounter(next);
  }

  useEffect(() => {
    fetchCurrentEncounter(token)
      .then((result) => updateEncounter(result.encounter))
      .catch(() => {
        // Leave encounter as-is; the next sync (or manual refresh) retries.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Optimistic vitality preview: re-anchors to the authoritative
  // encounter/lastSyncedAtRef every time either changes (a real sync,
  // engage, or spend-ap), then locally re-reads steps-since-that-anchor
  // every VITALITY_PREVIEW_INTERVAL_MS to predict damage ahead of the
  // next real sync. Display-only — see the liveVitality doc comment above.
  useEffect(() => {
    if (encounter?.status !== 'ACTIVE') {
      setLiveVitality(undefined);
      return;
    }

    const baselineVitality = encounter.currentVitality;
    let cancelled = false;

    async function preview() {
      try {
        const stepsSinceSync = await stepSource.getStepCountSince(lastSyncedAtRef.current);
        if (!cancelled) {
          setLiveVitality(Math.max(baselineVitality - stepsSinceSync, 0));
        }
      } catch {
        // Leave the previous preview value up; the next tick retries.
      }
    }

    void preview();
    const interval = setInterval(() => void preview(), VITALITY_PREVIEW_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [encounter]);

  useEffect(() => {
    let cancelled = false;

    async function flush() {
      if (!readyRef.current || syncingRef.current) return;

      const clientStartedAt = lastSyncedAtRef.current;
      const clientEndedAt = new Date();

      syncingRef.current = true;
      try {
        const stepCount = await stepSource.getStepCountSince(clientStartedAt);
        if (stepCount <= 0) return;

        const result = await syncActivity(token, {
          stepCount,
          clientStartedAt: clientStartedAt.toISOString(),
          clientEndedAt: clientEndedAt.toISOString(),
          location: locationRef.current,
        });
        lastSyncedAtRef.current = clientEndedAt;
        setBankedAp(result.bankedAp);

        if (result.combat?.defeated) {
          const defeatedName = encounterRef.current?.enemy.name ?? 'Enemy';
          setLevel((prev) => prev + result.combat!.levelsGained);
          setCombatMessage(
            result.combat.levelsGained > 0
              ? `${defeatedName} defeated! +${result.combat.xpAwarded} XP — level up!`
              : `${defeatedName} defeated! +${result.combat.xpAwarded} XP`
          );
          updateEncounter(null);
        } else {
          updateEncounter(result.encounter);
        }
      } catch {
        // Leave lastSyncedAtRef alone — the next tick re-covers this window.
      } finally {
        syncingRef.current = false;
      }
    }

    stepSource
      .initialize()
      .then((status) => {
        if (cancelled) return;
        setPedometerStatus(status);
        readyRef.current = status === 'active';
      })
      .catch(() => {
        if (!cancelled) setPedometerStatus('unavailable');
      });

    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      if (cancelled) return;
      const delay = encounterRef.current?.status === 'ACTIVE' ? ACTIVE_ENCOUNTER_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      timeoutId = setTimeout(async () => {
        await flush();
        scheduleNext();
      }, delay);
    }

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [token]);

  async function engage() {
    if (!encounterRef.current) return;
    const result = await engageEncounter(token, encounterRef.current.id);
    updateEncounter(result.encounter);
  }

  async function dismiss() {
    if (!encounterRef.current) return;
    await dismissEncounter(token, encounterRef.current.id);
    updateEncounter(null);
  }

  async function spendAp(amount: number) {
    if (!encounterRef.current) return;
    const defeatedName = encounterRef.current.enemy.name;
    const result = await spendApOnEncounter(token, encounterRef.current.id, amount);
    setBankedAp(result.bankedAp);

    if (result.defeated) {
      setLevel((prev) => prev + result.levelsGained);
      setCombatMessage(
        result.levelsGained > 0
          ? `${defeatedName} defeated! +${result.xpAwarded} XP — level up!`
          : `${defeatedName} defeated! +${result.xpAwarded} XP`
      );
      updateEncounter(null);
    } else {
      updateEncounter(result.encounter);
    }
  }

  return { bankedAp, level, pedometerStatus, encounter, liveVitality, combatMessage, engage, dismiss, spendAp };
}
