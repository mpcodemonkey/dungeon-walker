import { XP_BASE_PER_LEVEL } from './constants';

// Linear placeholder curve — see docs/chunk-4-combat.md.
export function xpForNextLevel(level: number): number {
  return XP_BASE_PER_LEVEL * level;
}

export interface LevelUpResult {
  xp: number;
  level: number;
  levelsGained: number;
}

export function applyXpGain(currentXp: number, currentLevel: number, xpGained: number): LevelUpResult {
  let xp = currentXp + xpGained;
  let level = currentLevel;
  let levelsGained = 0;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  return { xp, level, levelsGained };
}
