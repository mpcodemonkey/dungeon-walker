import { useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';
import { syncActivity } from '../api/client';

// Placeholder thresholds — tunable. See docs/chunk-3-movement.md.
const SYNC_STEP_THRESHOLD = 75;
const SYNC_INTERVAL_MS = 45_000;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface StepSyncResult {
  bankedAp: number;
  pedometerAvailable: boolean | undefined;
}

// Foreground-only step tracking (see docs/chunk-3-movement.md — background
// accrual is a separate, harder problem deferred to its own chunk).
export function useStepSync(token: string, initialBankedAp: number, location: Coordinates | undefined): StepSyncResult {
  const [bankedAp, setBankedAp] = useState(initialBankedAp);
  const [pedometerAvailable, setPedometerAvailable] = useState<boolean | undefined>(undefined);

  const cumulativeStepsRef = useRef(0);
  const lastSyncedStepsRef = useRef(0);
  const lastSyncedAtRef = useRef(new Date());
  const locationRef = useRef(location);
  const syncingRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    async function flush() {
      if (syncingRef.current) return;
      const pendingSteps = cumulativeStepsRef.current - lastSyncedStepsRef.current;
      if (pendingSteps <= 0) return;

      syncingRef.current = true;
      const clientStartedAt = lastSyncedAtRef.current;
      const clientEndedAt = new Date();
      try {
        const result = await syncActivity(token, {
          stepCount: pendingSteps,
          clientStartedAt: clientStartedAt.toISOString(),
          clientEndedAt: clientEndedAt.toISOString(),
          location: locationRef.current,
        });
        lastSyncedStepsRef.current = cumulativeStepsRef.current;
        lastSyncedAtRef.current = clientEndedAt;
        setBankedAp(result.bankedAp);
      } catch {
        // Leave the pending steps queued — the next step or timer tick retries.
      } finally {
        syncingRef.current = false;
      }
    }

    let subscription: { remove: () => void } | undefined;

    Pedometer.isAvailableAsync()
      .then((available) => {
        setPedometerAvailable(available);
        if (!available) return;

        subscription = Pedometer.watchStepCount(({ steps }) => {
          cumulativeStepsRef.current = steps;
          if (steps - lastSyncedStepsRef.current >= SYNC_STEP_THRESHOLD) {
            void flush();
          }
        });
      })
      .catch(() => setPedometerAvailable(false));

    const interval = setInterval(() => void flush(), SYNC_INTERVAL_MS);

    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, [token]);

  return { bankedAp, pedometerAvailable };
}
