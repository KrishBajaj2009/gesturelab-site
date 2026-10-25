// Bonus shapes stay hidden until enough original challenges have been mastered.
export const BASE_LEVEL_COUNT = 4;
export const UNLOCK_SCORE = 70;

export function masteryCount(bests, levels) {
  return levels.slice(0, BASE_LEVEL_COUNT)
    .filter(level => Number(bests?.[level.id]) >= UNLOCK_SCORE).length;
}

export function unlockedLevels(levels, bests) {
  const completed = masteryCount(bests, levels);
  return levels.filter(level => !level.secret || completed >= level.unlockCount);
}

export function canOpenLevel(level, bests, levels) {
  return Boolean(level) && (!level.secret || masteryCount(bests, levels) >= level.unlockCount);
}
