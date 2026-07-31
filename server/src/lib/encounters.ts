import type { Character, Encounter, Enemy } from '@prisma/client';
import { prisma } from './prisma';
import { ENCOUNTER_SPAWN_CHANCE, ENCOUNTER_PENDING_TTL_MS, STAT_GROWTH_PER_LEVEL } from './constants';
import { applyXpGain } from './leveling';

export type EncounterWithEnemy = Encounter & { enemy: Enemy };

export function serializeEncounter(encounter: EncounterWithEnemy) {
  return {
    id: encounter.id,
    status: encounter.status,
    currentVitality: encounter.currentVitality,
    enemy: {
      id: encounter.enemy.id,
      name: encounter.enemy.name,
      maxVitality: encounter.enemy.maxVitality,
    },
    spawnedAt: encounter.spawnedAt,
    expiresAt: encounter.expiresAt,
    engagedAt: encounter.engagedAt,
    resolvedAt: encounter.resolvedAt,
  };
}

// Current pending/active encounter for a character, lazily expiring a
// stale pending one first. Null if there isn't one. See
// docs/chunk-4-combat.md for the one-encounter-at-a-time decision.
export async function getCurrentEncounter(characterId: string): Promise<EncounterWithEnemy | null> {
  const encounter = await prisma.encounter.findFirst({
    where: { characterId, status: { in: ['PENDING', 'ACTIVE'] } },
    include: { enemy: true },
  });

  if (!encounter) return null;

  if (encounter.status === 'PENDING' && encounter.expiresAt <= new Date()) {
    await prisma.encounter.update({
      where: { id: encounter.id },
      data: { status: 'DESPAWNED' },
    });
    return null;
  }

  return encounter;
}

// Rolls a spawn chance for a character with no current encounter.
// Returns the new encounter if one spawned, else null. Caller is
// responsible for confirming there's no current encounter first.
export async function maybeSpawnEncounter(characterId: string): Promise<EncounterWithEnemy | null> {
  if (Math.random() >= ENCOUNTER_SPAWN_CHANCE) return null;

  const enemyCount = await prisma.enemy.count();
  if (enemyCount === 0) return null;

  const [enemy] = await prisma.enemy.findMany({
    skip: Math.floor(Math.random() * enemyCount),
    take: 1,
  });
  if (!enemy) return null;

  return prisma.encounter.create({
    data: {
      characterId,
      enemyId: enemy.id,
      currentVitality: enemy.maxVitality,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + ENCOUNTER_PENDING_TTL_MS),
    },
    include: { enemy: true },
  });
}

export interface ApplyDamageResult {
  encounter: EncounterWithEnemy;
  defeated: boolean;
  xpAwarded: number;
  levelsGained: number;
}

// Applies damage to an ACTIVE encounter. If it drops to 0, resolves it
// and awards XP/levels to the character in the same transaction.
export async function applyDamageToEncounter(
  encounter: EncounterWithEnemy,
  character: Character,
  damage: number
): Promise<ApplyDamageResult> {
  const nextVitality = Math.max(encounter.currentVitality - damage, 0);

  if (nextVitality > 0) {
    const updated = await prisma.encounter.update({
      where: { id: encounter.id },
      data: { currentVitality: nextVitality },
      include: { enemy: true },
    });
    return { encounter: updated, defeated: false, xpAwarded: 0, levelsGained: 0 };
  }

  const { xp, level, levelsGained } = applyXpGain(character.xp, character.level, encounter.enemy.xpReward);
  const statGrowth = levelsGained * STAT_GROWTH_PER_LEVEL;

  const [updatedEncounter] = await prisma.$transaction([
    prisma.encounter.update({
      where: { id: encounter.id },
      data: { currentVitality: 0, status: 'DEFEATED', resolvedAt: new Date() },
      include: { enemy: true },
    }),
    prisma.character.update({
      where: { id: character.id },
      data: {
        xp,
        level,
        strength: { increment: statGrowth },
        agility: { increment: statGrowth },
        focus: { increment: statGrowth },
        intelligence: { increment: statGrowth },
        wisdom: { increment: statGrowth },
        luck: { increment: statGrowth },
      },
    }),
  ]);

  return { encounter: updatedEncounter, defeated: true, xpAwarded: encounter.enemy.xpReward, levelsGained };
}
