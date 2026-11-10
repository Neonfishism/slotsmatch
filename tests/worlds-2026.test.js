import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS, ROLES, SEASONS, TEAMS } from '../src/worlds/data.js';
import { AVAILABLE_POOLS, createGame, roleScore, simulateWorlds, simulateWorlds2026 } from '../src/worlds/engine.js';

function referenceTeam() {
  const players = PLAYERS.filter(player => player.seasonId === '2024' && player.region === 'LCK');
  const team = {};
  for (const role of [...ROLES.map(role => role.id), 'bench']) {
    team[role] = players.filter(player => (role === 'bench' || player.role === role) && !Object.values(team).some(picked => picked.identity === player.identity))
      .sort((a, b) => roleScore(b, role) - roleScore(a, role))[0];
  }
  return team;
}

test('every historic draft pool settles as the same 2026 Swiss main event', () => {
  const team = referenceTeam();
  for (const pool of AVAILABLE_POOLS) {
    const game = { ...createGame({ seed: 'fixed-2026-field', date: '2026-11-10' }), ...pool };
    const result = simulateWorlds2026(game, team);
    assert.equal(result.seasonId, '2026');
    assert.equal(result.tournamentYear, 2026);
    assert.equal(result.tournamentLabel, '2026 全球总决赛');
    assert.equal(result.tournamentSeasonLabel, 'S16');
    assert.equal(result.format, 'swiss');
    assert.equal(result.fieldSize, 16);
    assert.equal(result.regionId, pool.regionId);
    assert.equal(result.draftSeasonId, pool.seasonId);
    assert.equal(result.opponentSeasonId, '2024');
    assert.match(result.simulationNote, /S14 历史阵容/);
    assert.equal(result.groups, undefined);
    assert.equal(result.swissRounds.length, 5);
    assert([1, 2, 3, 5, 9, 12, 15].includes(result.rank));
  }
});

test('changing only the historical draw season cannot change a 2026 result', () => {
  const team = referenceTeam();
  const game = { ...createGame({ seed: 'same-event', date: '2026-11-10' }), regionId: 'LCK' };
  const results = SEASONS.map(season => {
    const { draftSeasonId, ...result } = simulateWorlds2026({ ...game, seasonId: season.id }, team);
    assert.equal(draftSeasonId, season.id);
    return result;
  });
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.deepEqual(simulateWorlds2026(game, team), simulateWorlds2026(game, team));
});

test('2026 matches use legal Swiss records, no rematches and BO5 knockouts', () => {
  const team = referenceTeam();
  const opponentIds = new Set(TEAMS.filter(team => team.seasonId === '2024' && team.mainEvent).map(team => team.id));
  for (let index = 0; index < 30; index++) {
    const game = createGame({ seed: `2026-format:${index}`, date: '2026-11-10' });
    const result = simulateWorlds2026(game, team);
    const opponents = new Set();
    for (const match of result.matches) {
      assert(opponentIds.has(match.opponentId));
      if (match.stage.startsWith('瑞士轮')) {
        assert(!opponents.has(match.opponentId));
        opponents.add(match.opponentId);
        assert.deepEqual(match.recordBefore, match.opponentRecordBefore);
        const { wins, losses } = match.recordBefore;
        assert(wins < 3 && losses < 3);
        assert.equal(match.format, wins === 2 || losses === 2 ? 'BO3' : 'BO1');
      } else {
        assert.equal(match.format, 'BO5');
      }
    }
    assert.equal(result.record.wins, result.matches.reduce((sum, match) => sum + match.wins, 0));
    assert.equal(result.record.losses, result.matches.reduce((sum, match) => sum + match.losses, 0));
  }
});

test('2026 settlement preserves roster validation and the historical simulator', () => {
  const game = { ...createGame({ seed: 'validation-2026', date: '2026-11-10' }), seasonId: '2024', regionId: 'LCK' };
  const team = referenceTeam();
  assert.throws(() => simulateWorlds2026(game, { ...team, bench: null }), /完整/);
  assert.throws(() => simulateWorlds2026(game, { ...team, bench: team.top }), /重复/);
  assert.throws(() => simulateWorlds2026({ ...game, seasonId: '2026' }, team), /选手池/);
  assert.equal(simulateWorlds(game, team).seasonId, '2024');
  assert.equal(simulateWorlds2026(game, team).seasonId, '2026');
});
