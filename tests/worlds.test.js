import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS, TEAMS, SEASONS, ROLES, STAT_KEYS } from '../src/worlds/data.js';
import { AVAILABLE_POOLS, createGame, drawCandidates, evaluateTeam, gameAtRound, hashSeed, roleScore, seededRandom, simulateWorlds } from '../src/worlds/engine.js';

const slots = [...ROLES.map(role => role.id), 'bench'];
const identity = player => String(player.identity || player.name).toLowerCase();
const lookup = new Map(PLAYERS.map(player => [player.id, player]));
const poolPlayers = pool => PLAYERS.filter(player => player.seasonId === pool.seasonId && player.region === pool.regionId);
const gameFor = (pool, seed = 'test-worlds') => ({ ...createGame({ seed, date: '2026-11-10' }), seasonId: pool.seasonId, regionId: pool.regionId, tournamentSeed: hashSeed(`event:${seed}`) });
function nativeTeam(pool) {
  const players = poolPlayers(pool);
  const team = {};
  for (const role of ROLES) {
    team[role.id] = players.filter(player => player.role === role.id && !Object.values(team).some(picked => identity(picked) === identity(player))).sort((a, b) => roleScore(b, role.id) - roleScore(a, role.id))[0];
    assert(team[role.id], `${pool.seasonId}/${pool.regionId} needs a native ${role.id}`);
  }
  team.bench = players.filter(player => !Object.values(team).some(picked => identity(picked) === identity(player))).sort((a, b) => roleScore(b, 'bench') - roleScore(a, 'bench'))[0];
  return team;
}

test('Worlds data includes all tournament stages, valid six-dimensional archives and sixteen actual main-event teams', () => {
  assert(SEASONS.length >= 2);
  assert.equal(new Set(PLAYERS.map(player => player.id)).size, PLAYERS.length);
  for (const season of SEASONS) {
    const teams = TEAMS.filter(team => team.seasonId === season.id);
    const players = PLAYERS.filter(player => player.seasonId === season.id);
    assert.equal(teams.length, season.teamCount);
    assert.equal(teams.filter(team => team.mainEvent).length, 16);
    assert(teams.some(team => !team.mainEvent), `${season.label} needs its play-in participants too`);
    assert(players.length >= teams.length * 5);
    assert(players.some(player => teams.some(team => team.id === player.teamId && !team.mainEvent)));
    assert.equal(new Set(players.map(identity)).size, players.length, 'one seasonal archive per player identity');
    for (const player of players) {
      assert(teams.some(team => team.id === player.teamId && team.region === player.region));
      assert(ROLES.some(role => role.id === player.role));
      assert(STAT_KEYS.every(key => Number.isInteger(player.stats[key]) && player.stats[key] >= 0 && player.stats[key] <= 100));
    }
  }
});

test('random games replay exactly, use Shanghai daily dates and select only pools that can offer six players through round six', () => {
  assert.deepEqual(createGame({ seed: 'repeatable', date: '2026-11-10' }), createGame({ seed: 'repeatable', date: '2026-11-10' }));
  const a = seededRandom('随机');
  const b = seededRandom('随机');
  assert.deepEqual(Array.from({ length: 10 }, () => a()), Array.from({ length: 10 }, () => b()));
  assert.deepEqual(createGame({ mode: 'daily', seed: 'ignored', date: '2026-11-09T16:00:00Z' }), createGame({ mode: 'daily', date: '2026-11-10' }));
  assert.throws(() => createGame({ date: '2026-02-30' }), /日期/);
  assert.throws(() => createGame({ mode: 'bad' }), /模式/);
  assert.throws(() => createGame({ seed: '' }), /种子/);
  for (const pool of AVAILABLE_POOLS) {
    assert.equal(pool.playerCount, new Set(poolPlayers(pool).map(identity)).size);
    assert(pool.playerCount >= 11);
  }
  const seenSeasons = new Set();
  for (let index = 0; index < 120; index++) {
    const game = createGame({ seed: `all-pools:${index}`, date: '2026-11-10' });
    seenSeasons.add(game.seasonId);
    assert(AVAILABLE_POOLS.some(pool => pool.seasonId === game.seasonId && pool.regionId === game.regionId));
  }
  assert.equal(seenSeasons.size, SEASONS.length);
});

test('every active pool sustains six rounds of six unique in-region candidates and excludes all already recruited identities', () => {
  for (const pool of AVAILABLE_POOLS) {
    const game = gameFor(pool);
    const team = {};
    for (let roundIndex = 0; roundIndex < 6; roundIndex++) {
      const offer = drawCandidates(game, team, roundIndex);
      assert.equal(offer.length, 6);
      assert.equal(new Set(offer.map(identity)).size, 6);
      assert(offer.every(player => player.seasonId === game.seasonId && player.region === game.regionId));
      assert(!offer.some(player => Object.values(team).some(picked => identity(picked) === identity(player))));
      assert.deepEqual(offer, drawCandidates(game, team, roundIndex));
      team[slots[roundIndex]] = offer[0];
    }
    assert.equal(Object.keys(team).length, 6);
    assert.throws(() => drawCandidates(game, team, -1), /序号/);
    assert.throws(() => drawCandidates(game, team, 8), /序号/);
  }
});

test('candidate draws do not change when the same recruits swap lineup positions or load from saved ids', () => {
  const pool = AVAILABLE_POOLS[0];
  const team = nativeTeam(pool);
  const game = gameFor(pool);
  const a = { top: team.top, mid: team.mid };
  const b = { top: team.mid, jungle: team.top };
  const c = { top: team.top.id, mid: team.mid.id };
  assert.deepEqual(drawCandidates(game, a, 2), drawCandidates(game, b, 2));
  assert.deepEqual(drawCandidates(game, a, 2), drawCandidates(game, c, 2));
  const seen = new Set();
  for (let index = 0; index < 120; index++) drawCandidates(gameFor(pool, `coverage:${index}`)).forEach(player => seen.add(player.id));
  assert.equal(seen.size, poolPlayers(pool).length, 'sampling covers the complete regional Worlds pool');
});

test('native role fit, off-role penalties, roster familiarity and the sixth player materially affect the team score', () => {
  assert.equal(evaluateTeam({}).rating, 0);
  const pool = AVAILABLE_POOLS[0];
  const team = nativeTeam(pool);
  for (const role of ROLES) {
    const equal = { ...team[role.id], stats: Object.fromEntries(STAT_KEYS.map(key => [key, 80])) };
    assert.equal(roleScore(equal, role.id), 80);
    assert(ROLES.filter(other => other.id !== role.id).every(other => roleScore(equal, other.id) < 80));
  }
  const matched = evaluateTeam(team);
  const swapped = evaluateTeam({ ...team, jungle: team.adc, adc: team.jungle });
  assert(matched.rating > swapped.rating);
  assert.equal(swapped.offRoleCount, 2);
  assert(matched.benchBonus > 0);
  assert(matched.rating > evaluateTeam({ ...team, bench: null }).rating);
  const improved = Object.fromEntries(Object.entries(team).map(([role, player]) => [role, { ...player, stats: Object.fromEntries(STAT_KEYS.map(key => [key, Math.min(100, player.stats[key] + 3)])) }]));
  assert(evaluateTeam(improved).rating >= matched.rating);
  assert.throws(() => roleScore({ ...team.top, stats: {} }, 'top'), /六维/);
  assert.throws(() => roleScore(team.top, 'coach'), /位置/);
});

test('world championship simulation rejects incomplete, repeated and unknown lineups and resolves canonical capabilities', () => {
  const pool = AVAILABLE_POOLS[0];
  const game = gameFor(pool);
  const team = nativeTeam(pool);
  assert.throws(() => simulateWorlds(game, { ...team, bench: null }), /完整/);
  assert.throws(() => simulateWorlds(game, { ...team, bench: team.top }), /重复/);
  const other = PLAYERS.find(player => player.seasonId !== game.seasonId || player.region !== game.regionId);
  assert.throws(() => simulateWorlds({ ...game, rulesVersion: 1 }, { ...team, bench: other }), /赛季和赛区/);
  assert.throws(() => simulateWorlds(game, { ...team, bench: { ...team.bench, id: 'invented-player' } }), /参赛名单/);
  assert.deepEqual(simulateWorlds(game, { ...team, bench: { ...team.bench, stats: { ...team.bench.stats, vision: NaN } } }), simulateWorlds(game, team), 'a supplied object cannot replace archived player attributes');
});

test('each signing advances to a reproducible season and region, excluding recruited identities across seasons', () => {
  const sequences = new Set();
  for (let index = 0; index < 80; index++) {
    const original = createGame({ seed: `round-signings:${index}`, date: '2026-11-10' });
    assert.equal(original.rulesVersion, 2);
    assert.equal(original.roundIndex, 0);
    const team = {};
    const seenPools = new Set();
    for (let roundIndex = 0; roundIndex < 6; roundIndex++) {
      const game = gameAtRound(original, roundIndex);
      seenPools.add(`${game.seasonId}/${game.regionId}`);
      assert.equal(game.seed, original.seed);
      assert.equal(game.tournamentSeed, original.tournamentSeed);
      assert.equal(game.roundIndex, roundIndex);
      assert.deepEqual(game, createGame({ seed: original.seed, date: original.day, roundIndex }));
      assert.deepEqual(game, gameAtRound(gameAtRound(original, 5), roundIndex));
      const candidates = drawCandidates(game, team, roundIndex);
      assert.equal(candidates.length, 6);
      assert(candidates.every(player => player.seasonId === game.seasonId && player.region === game.regionId));
      assert(!candidates.some(player => Object.values(team).some(picked => identity(picked) === identity(player))));
      assert.deepEqual(candidates, drawCandidates(game, team, roundIndex));
      team[slots[roundIndex]] = candidates[0];
    }
    assert(seenPools.size > 1, 'six rounds must not be locked to the first event pool');
    sequences.add([...seenPools].join('|'));
    const finalGame = gameAtRound(original, 5);
    const result = simulateWorlds(finalGame, team);
    assert.equal(result.seasonId, finalGame.seasonId);
    assert.equal(result.regionId, finalGame.regionId);
    assert.equal(result.replacementTeam.region, finalGame.regionId);
    assert(result.matches.every(match => match.opponentId.startsWith(`${finalGame.seasonId}-`)));
    assert.deepEqual(result, simulateWorlds(finalGame, Object.fromEntries(Object.entries(team).map(([slot, player]) => [slot, player.id]))));
  }
  assert(sequences.size > 60);
  const original = createGame({ seed: 'invalid-rounds' });
  assert.throws(() => gameAtRound(original, -1), /轮次/);
  assert.throws(() => gameAtRound(original, 6), /轮次/);
  assert.throws(() => createGame({ rulesVersion: 3 }), /版本/);
});

test('mixed-season drafts retain seasonal abilities but cannot recruit another version of the same person', () => {
  const pool = AVAILABLE_POOLS.find(pool => pool.seasonId === '2024' && pool.regionId === 'LCK');
  const game = gameFor(pool, 'cross-season-identities');
  const earlier = PLAYERS.find(player => player.name === 'Faker' && player.seasonId === '2021');
  const current = PLAYERS.find(player => player.name === 'Faker' && player.seasonId === '2024');
  assert(earlier && current);
  assert.equal(identity(earlier), identity(current));
  for (let drawIndex = 0; drawIndex <= 7; drawIndex++) {
    const candidates = drawCandidates(game, { mid: earlier }, drawIndex);
    assert(!candidates.some(player => identity(player) === identity(earlier)));
  }
  const team = nativeTeam(pool);
  const foreign = PLAYERS.find(player => player.seasonId === '2022' && !Object.values(team).some(picked => identity(picked) === identity(player)));
  const mixed = { ...team, bench: foreign };
  assert.doesNotThrow(() => simulateWorlds(game, mixed));
  assert.throws(() => simulateWorlds({ ...game, rulesVersion: 1 }, mixed), /赛季和赛区/);
  const repeated = { ...team, top: earlier, mid: current };
  assert.throws(() => simulateWorlds(game, repeated), /重复/);
});

test('legacy fixed-pool saves keep their original draws and repeatable matches under the current ratings', () => {
  const game = createGame({ seed: 'legacy-worlds-regression', date: '2026-11-10', rulesVersion: 1 });
  assert.deepEqual(game, { rulesVersion: 1, seed: 'legacy-worlds-regression', mode: 'free', day: '2026-11-10', seasonId: '2022', regionId: 'LCS', tournamentSeed: 1215260210 });
  assert.deepEqual(drawCandidates(game).map(player => player.id), ['2022-closer', '2022-berserker', '2022-ssumday', '2022-blaber', '2022-impact', '2022-vulcan']);
  for (let roundIndex = 0; roundIndex < 6; roundIndex++) {
    const legacyRound = gameAtRound(game, roundIndex);
    assert.equal(legacyRound.seasonId, game.seasonId);
    assert.equal(legacyRound.regionId, game.regionId);
  }
  const team = {};
  for (let roundIndex = 0; roundIndex < 6; roundIndex++) team[slots[roundIndex]] = drawCandidates(game, team, roundIndex)[0].id;
  assert.deepEqual(team, { top: '2022-closer', jungle: '2022-berserker', mid: '2022-vulcan', adc: '2022-abbedagge', support: '2022-fbi', bench: '2022-zven' });
  const result = simulateWorlds(game, team);
  assert.deepEqual(result, simulateWorlds(game, team));
  assert.deepEqual(result.matches.slice(0, 6).map(match => match.opponentId), ['2022-RNG', '2022-DRX', '2022-FNC', '2022-RNG', '2022-DRX', '2022-FNC']);
  assert(result.matches.slice(0, 6).every(match => match.format === 'BO1' && match.wins + match.losses === 1));
  assert.deepEqual(result.record, result.matches.reduce((record, match) => ({ wins: record.wins + match.wins, losses: record.losses + match.losses }), { wins: 0, losses: 0 }));
});

test('every supported season runs a deterministic sixteen-team tournament with correct opponents and internally consistent results', () => {
  for (const season of SEASONS) {
    const pool = AVAILABLE_POOLS.find(candidate => candidate.seasonId === season.id);
    const team = nativeTeam(pool);
    const asIds = Object.fromEntries(Object.entries(team).map(([role, player]) => [role, player.id]));
    for (let index = 0; index < 12; index++) {
      const game = gameFor(pool, `simulation:${index}`);
      const result = simulateWorlds(game, team);
      assert.deepEqual(result, simulateWorlds(game, asIds));
      assert.equal(result.fieldSize, 16);
      assert.equal(result.replacementTeam.region, game.regionId);
      assert(result.placement && result.stage && result.rank >= 1 && result.rank <= 16);
      assert.equal(result.matches.reduce((total, match) => total + match.wins, 0), result.record.wins);
      assert.equal(result.matches.reduce((total, match) => total + match.losses, 0), result.record.losses);
      assert.equal(result.seriesRecord.wins + result.seriesRecord.losses, result.matches.length);
      for (const match of result.matches) {
        const opponent = TEAMS.find(candidate => candidate.id === match.opponentId);
        assert(opponent && opponent.seasonId === season.id && opponent.mainEvent);
        assert.notEqual(opponent.id, result.replacementTeam.id);
        const needed = Math.ceil(Number(match.format.slice(2)) / 2);
        assert.equal(Math.max(match.wins, match.losses), needed);
        assert.equal(match.won, match.wins > match.losses);
        assert(match.reason.length > 0);
      }
      const knockout = result.matches.filter(match => match.format === 'BO5');
      assert(knockout.length <= 3);
      assert.equal(result.qualified, knockout.length > 0);
      if (result.rank === 1) assert.equal(knockout.filter(match => match.won).length, 3);
      else if (knockout.length) assert.equal(knockout.at(-1).won, false);
      const quarterfinals = result.knockout.filter(match => match.stage === '四分之一决赛');
      assert.equal(quarterfinals.length, 4);
      const halves = [quarterfinals.slice(0, 2), quarterfinals.slice(2)].map(pairs => pairs.flatMap(pair => [pair.a, pair.b]));
      if (season.format === 'groups') {
        assert.equal(result.groups.length, 4);
        for (const group of result.groups) {
          assert.equal(group.teams.length, 4);
          assert.equal(new Set(group.teams.map(contestant => contestant.region)).size, 4);
          assert(group.teams.every(contestant => contestant.wins + contestant.losses === 6));
        }
        const regular = result.matches.filter(match => match.stage.startsWith('小组赛'));
        assert.equal(regular.length, 6);
        assert.equal(new Set(regular.map(match => match.opponentId)).size, 3);
        for (const half of halves) {
          const groupNames = half.map(tag => result.groups.find(group => group.teams.some(contestant => contestant.tag === tag)).name);
          assert.equal(new Set(groupNames).size, 4, 'group winners and runners must be in opposite halves');
        }
      } else {
        const swiss = result.matches.filter(match => match.stage.startsWith('瑞士轮'));
        assert(swiss.length >= 3 && swiss.length <= 5);
        if (season.year >= 2024) assert.equal(new Set(swiss.map(match => match.opponentId)).size, swiss.length);
        assert.notEqual(swiss[0].opponentRegion, game.regionId);
        let wins = 0;
        let losses = 0;
        for (const match of swiss) {
          assert.deepEqual(match.recordBefore, { wins, losses });
          assert.deepEqual(match.opponentRecordBefore, match.recordBefore);
          assert.equal(match.format, wins === 2 || losses === 2 ? 'BO3' : 'BO1');
          if (match.won) wins++; else losses++;
        }
        assert.deepEqual(result.swissRecord, { wins, losses });
        assert(wins === 3 || losses === 3);
        assert.equal(result.qualified, wins === 3);
        const unbeaten = result.swissRounds[2].matches.filter(match => match.recordBefore.wins === 2 && match.recordBefore.losses === 0).map(match => match.winner);
        assert.equal(unbeaten.length, 2);
        for (const half of halves) assert.equal(half.filter(tag => unbeaten.includes(tag)).length, 1, '3–0 teams must be in opposite halves');
      }
    }
  }
});

test('higher capabilities improve tournament outcomes across the same fixed challenges; champions and elimination remain possible', () => {
  const pool = [...AVAILABLE_POOLS].sort((a, b) => evaluateTeam(nativeTeam(b)).rating - evaluateTeam(nativeTeam(a)).rating)[0];
  const strong = nativeTeam(pool);
  const available = poolPlayers(pool);
  const weak = {};
  for (const role of slots) {
    weak[role] = available.filter(player => !Object.values(weak).some(picked => identity(picked) === identity(player))).sort((a, b) => roleScore(a, role) - roleScore(b, role))[0];
  }
  assert(evaluateTeam(strong).rating > evaluateTeam(weak).rating + 10);
  let strongWins = 0;
  let weakWins = 0;
  let champions = 0;
  let eliminations = 0;
  for (let index = 0; index < 60; index++) {
    const game = gameFor(pool, `ability:${index}`);
    const better = simulateWorlds(game, strong);
    const worse = simulateWorlds(game, weak);
    strongWins += better.seriesRecord.wins;
    weakWins += worse.seriesRecord.wins;
    champions += Number(better.rank === 1);
    eliminations += Number(!worse.qualified);
  }
  assert(strongWins > weakWins * 2);
  assert(champions > 0);
  assert(eliminations > 0);
});
