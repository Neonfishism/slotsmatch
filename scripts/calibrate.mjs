import { ROLES } from '../src/data.js';
import { createGame, drawCandidates, roleScore, seededRandom, simulateMissions } from '../src/engine.js';

const trials = 2000;
const previousDifficulties = [40, 44, 48, 52, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 82, 85, 89, 93];
const adjustments = [0, 2, 3];
const summary = () => ({ total: 0, perfect: 0, distribution: {} });
const addWins = (stats, wins) => {
  stats.total += wins;
  stats.perfect += wins === 20 ? 1 : 0;
  stats.distribution[wins] = (stats.distribution[wins] ?? 0) + 1;
};
const report = stats => ({
  meanWins: +(stats.total / trials).toFixed(3),
  perfect: stats.perfect,
  perfectRate: stats.perfect / trials,
  distribution: stats.distribution,
});

for (const strategy of ['random', 'role-fit']) {
  const current = summary();
  const comparisons = new Map(adjustments.map(adjustment => [adjustment, summary()]));
  const missionTypeTotals = {};
  const missionTypeRanges = {};
  const storyEraTotals = {};
  const villageTotals = {};
  let currentDifficultyAdjustment;
  for (let trial = 0; trial < trials; trial++) {
    const game = createGame({ seed: `calibration-${trial}`, date: '2026-11-09' });
    if (game.rulesVersion !== 3 || game.eras.some((era, index) =>
      era === 'legacy' || (index > 0 && era === game.eras[index - 1]))) {
      throw new Error('Calibration expects the current four story eras without consecutive repeats.');
    }
    for (let index = 0; index < game.eras.length; index++) {
      storyEraTotals[game.eras[index]] = (storyEraTotals[game.eras[index]] ?? 0) + 1;
      villageTotals[game.draws[index]] = (villageTotals[game.draws[index]] ?? 0) + 1;
    }
    const random = seededRandom(`choices-${trial}`);
    const team = {};
    ROLES.forEach((role, index) => {
      // Match a game with no redraws: every new round consumes its own draw index.
      const candidates = drawCandidates(game.draws[index], team, game.seed, index, game.eras[index]);
      team[role.id] = strategy === 'random'
        ? candidates[Math.floor(random() * candidates.length)]
        : [...candidates].sort((a, b) => roleScore(b, role.id) - roleScore(a, role.id))[0];
    });
    const result = simulateMissions(team, game.missionSeed);
    const liveAdjustment = result.missions[0].difficulty - previousDifficulties[0];
    if (result.missions.length !== previousDifficulties.length || result.missions.some((mission, index) =>
      mission.difficulty - previousDifficulties[index] !== liveAdjustment)) {
      throw new Error('Calibration expects one uniform adjustment to the previous difficulty curve.');
    }
    if (currentDifficultyAdjustment !== undefined && currentDifficultyAdjustment !== liveAdjustment) {
      throw new Error('Mission difficulty changed between trials.');
    }
    currentDifficultyAdjustment = liveAdjustment;
    addWins(current, result.wins);
    for (const [adjustment, stats] of comparisons) {
      // Rejudge the same team, task types, scores and luck; only thresholds change.
      const wins = result.missions.filter(mission => mission.score + mission.luck >=
        mission.difficulty - liveAdjustment + adjustment).length;
      addWins(stats, wins);
    }
    const packageTypeCounts = {};
    for (const mission of result.missions) {
      missionTypeTotals[mission.type] = (missionTypeTotals[mission.type] ?? 0) + 1;
      packageTypeCounts[mission.type] = (packageTypeCounts[mission.type] ?? 0) + 1;
    }
    for (const type of ['潜入', '追踪', '强袭', '护送']) {
      const count = packageTypeCounts[type] ?? 0;
      const range = missionTypeRanges[type] ?? { min: 20, max: 0 };
      range.min = Math.min(range.min, count);
      range.max = Math.max(range.max, count);
      missionTypeRanges[type] = range;
    }
  }
  console.log(JSON.stringify({
    strategy,
    trials,
    rulesVersion: 3,
    draft: 'four balanced story eras without consecutive repeats, six candidates per draw, fixed role order, no redraws',
    currentDifficultyAdjustment,
    current: report(current),
    difficultyComparison: Object.fromEntries([...comparisons].map(([adjustment, stats]) => [
      adjustment === 0 ? 'previous' : `plus${adjustment}`, report(stats),
    ])),
    missionTypeTotals,
    missionTypeRanges,
    storyEraTotals,
    villageTotals,
  }));
}
