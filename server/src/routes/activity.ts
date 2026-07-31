import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  MAX_BANKED_AP,
  MAX_PLAUSIBLE_STEPS_PER_MINUTE,
  MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND,
} from '../lib/constants';
import {
  getCurrentEncounter,
  maybeSpawnEncounter,
  applyDamageToEncounter,
  serializeEncounter,
  type EncounterWithEnemy,
} from '../lib/encounters';

export const activityRouter = Router();

const syncSchema = z.object({
  stepCount: z.number().int().positive().max(20000),
  clientStartedAt: z.string().datetime(),
  clientEndedAt: z.string().datetime(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const earthRadiusMeters = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

activityRouter.post('/sync', requireAuth, async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }
  const { stepCount, location } = parsed.data;
  const clientStartedAt = new Date(parsed.data.clientStartedAt);
  const clientEndedAt = new Date(parsed.data.clientEndedAt);
  const { userId } = req as AuthenticatedRequest;

  const elapsedMs = clientEndedAt.getTime() - clientStartedAt.getTime();
  if (elapsedMs <= 0) {
    res.status(400).json({ error: 'clientEndedAt must be after clientStartedAt' });
    return;
  }

  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const flagReasons: string[] = [];

  const stepsPerMinute = stepCount / (elapsedMs / 60_000);
  if (stepsPerMinute > MAX_PLAUSIBLE_STEPS_PER_MINUTE) {
    flagReasons.push(`steps-per-minute ${stepsPerMinute.toFixed(1)} exceeds plausible cadence`);
  }

  if (location) {
    const previousSync = await prisma.activitySync.findFirst({
      where: { characterId: character.id, latitude: { not: null }, longitude: { not: null } },
      orderBy: { clientEndedAt: 'desc' },
    });

    if (previousSync?.latitude != null && previousSync.longitude != null) {
      const gapMs = clientStartedAt.getTime() - previousSync.clientEndedAt.getTime();
      if (gapMs > 0) {
        const distanceMeters = haversineMeters(
          { latitude: previousSync.latitude, longitude: previousSync.longitude },
          location
        );
        const speedMetersPerSecond = distanceMeters / (gapMs / 1000);
        if (speedMetersPerSecond > MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND) {
          flagReasons.push(`implied speed ${speedMetersPerSecond.toFixed(1)}m/s exceeds plausible pace`);
        }
      }
    }
  }

  const flagged = flagReasons.length > 0;

  const activitySyncData = {
    characterId: character.id,
    stepCount,
    clientStartedAt,
    clientEndedAt,
    latitude: location?.latitude,
    longitude: location?.longitude,
    flagged,
    flagReason: flagged ? flagReasons.join('; ') : undefined,
  };

  const currentEncounter = await getCurrentEncounter(character.id);

  let bankedAp = character.bankedAp;
  let encounterAfter: EncounterWithEnemy | null = currentEncounter;
  let combat: { defeated: boolean; xpAwarded: number; levelsGained: number } | null = null;

  if (currentEncounter?.status === 'ACTIVE') {
    // Steps during an active encounter are consumed as damage, not
    // banked — see docs/chunk-4-combat.md.
    const result = await applyDamageToEncounter(currentEncounter, character, stepCount);
    encounterAfter = result.defeated ? null : result.encounter;
    combat = { defeated: result.defeated, xpAwarded: result.xpAwarded, levelsGained: result.levelsGained };

    await prisma.activitySync.create({ data: activitySyncData });
  } else {
    bankedAp = Math.min(character.bankedAp + stepCount, MAX_BANKED_AP);

    if (!currentEncounter) {
      const spawned = await maybeSpawnEncounter(character.id);
      if (spawned) encounterAfter = spawned;
    }

    await prisma.$transaction([
      prisma.activitySync.create({ data: activitySyncData }),
      prisma.character.update({ where: { id: character.id }, data: { bankedAp } }),
    ]);
  }

  res.json({
    bankedAp,
    accepted: true,
    flagged,
    encounter: encounterAfter ? serializeEncounter(encounterAfter) : null,
    combat,
  });
});
