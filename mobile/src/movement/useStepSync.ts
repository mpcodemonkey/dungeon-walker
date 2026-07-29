import { useEffect, useRef, useState } from 'react';
import { syncActivity } from '../api/client';
import { stepSource } from './stepSource';
import type { PedometerStatus } from './stepSource.types';

export type { PedometerStatus };

// Placeholder — tunable. See docs/chunk-3-movement.md.
const POLL_INTERVAL_MS = 45_000;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface StepSyncResult {
  bankedAp: number;
  pedometerStatus: PedometerStatus;
}

// Foreground-only step tracking (see docs/chunk-3-movement.md — background
// accrual is a separate, harder problem deferred to its own chunk).
export function useStepSync(token: string, initialBankedAp: number, location: Coordinates | undefined): StepSyncResult {
  const [bankedAp, setBankedAp] = useState(initialBankedAp);
  const [pedometerStatus, setPedometerStatus] = useState<PedometerStatus>('checking');

  const lastSyncedAtRef = useRef(new Date());
  const locationRef = useRef(location);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

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

  return { bankedAp, pedometerStatus };
}
