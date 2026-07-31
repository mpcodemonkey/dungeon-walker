import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Placeholder bestiary — just enough variety to prove the combat
// mechanic. Real enemy content is a later pass. See docs/chunk-4-combat.md.
const ENEMIES = [
  { name: 'Rustbound Scavenger', maxVitality: 30, xpReward: 10 },
  { name: 'Feral Dog Pack', maxVitality: 60, xpReward: 20 },
  { name: 'Wasteland Marauder', maxVitality: 100, xpReward: 35 },
];

async function main() {
  for (const enemy of ENEMIES) {
    const existing = await prisma.enemy.findFirst({ where: { name: enemy.name } });
    if (!existing) {
      await prisma.enemy.create({ data: enemy });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
