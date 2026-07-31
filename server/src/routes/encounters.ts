import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getCurrentEncounter, applyDamageToEncounter, serializeEncounter, type EncounterWithEnemy } from '../lib/encounters';

export const encountersRouter = Router();

function encounterIdParam(req: Request): string | undefined {
  const { id } = req.params;
  return typeof id === 'string' ? id : undefined;
}

async function findOwnedEncounter(
  characterId: string,
  encounterId: string | undefined
): Promise<EncounterWithEnemy | undefined> {
  if (!encounterId) return undefined;
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { enemy: true },
  });
  if (!encounter || encounter.characterId !== characterId) return undefined;
  return encounter;
}

encountersRouter.get('/current', requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const encounter = await getCurrentEncounter(character.id);
  res.json({ encounter: encounter ? serializeEncounter(encounter) : null });
});

encountersRouter.post('/:id/engage', requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const encounter = await findOwnedEncounter(character.id, encounterIdParam(req));
  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found' });
    return;
  }
  if (encounter.status !== 'PENDING') {
    res.status(409).json({ error: 'Encounter is not pending' });
    return;
  }
  if (encounter.expiresAt <= new Date()) {
    await prisma.encounter.update({ where: { id: encounter.id }, data: { status: 'DESPAWNED' } });
    res.status(409).json({ error: 'Encounter has despawned' });
    return;
  }

  const updated = await prisma.encounter.update({
    where: { id: encounter.id },
    data: { status: 'ACTIVE', engagedAt: new Date() },
    include: { enemy: true },
  });

  res.json({ encounter: serializeEncounter(updated) });
});

encountersRouter.post('/:id/dismiss', requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const encounter = await findOwnedEncounter(character.id, encounterIdParam(req));
  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found' });
    return;
  }
  if (encounter.status !== 'PENDING') {
    res.status(409).json({ error: 'Only a pending encounter can be dismissed' });
    return;
  }

  await prisma.encounter.update({ where: { id: encounter.id }, data: { status: 'DESPAWNED' } });
  res.json({ ok: true });
});

const spendApSchema = z.object({
  amount: z.number().int().positive(),
});

encountersRouter.post('/:id/spend-ap', requireAuth, async (req, res) => {
  const parsed = spendApSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }

  const encounter = await findOwnedEncounter(character.id, encounterIdParam(req));
  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found' });
    return;
  }
  if (encounter.status !== 'ACTIVE') {
    res.status(409).json({ error: 'Encounter is not active' });
    return;
  }

  const amount = Math.min(parsed.data.amount, character.bankedAp);
  if (amount <= 0) {
    res.status(400).json({ error: 'No banked AP to spend' });
    return;
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { bankedAp: { decrement: amount } },
  });

  const result = await applyDamageToEncounter(encounter, character, amount);

  res.json({
    encounter: serializeEncounter(result.encounter),
    defeated: result.defeated,
    xpAwarded: result.xpAwarded,
    levelsGained: result.levelsGained,
    bankedAp: character.bankedAp - amount,
  });
});
