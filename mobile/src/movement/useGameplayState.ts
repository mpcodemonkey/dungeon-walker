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

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GameplayState {
  bankedAp: number;
  level: number;
  pedometerStatus: PedometerStatus;
  encounter: Encounter | null;
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

    const interval = setInterval(() => void flush(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
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

  return { bankedAp, level, pedometerStatus, encounter, combatMessage, engage, dismiss, spendAp };
}
