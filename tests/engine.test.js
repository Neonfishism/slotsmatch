import test from 'node:test';
import assert from 'node:assert/strict';
import { NINJAS, ROLES, STAT_KEYS, VILLAGES } from '../src/data.js';
import { DRAFT_POOLS, ERAS, NINJA_VERSIONS } from '../src/eras.js';
import { createGame, createMissionPlan, drawCandidates, evaluateTeam, getCandidates, hashSeed, roleScore, seededRandom, simulateMissions } from '../src/engine.js';

const ids = ['captain', 'scout', 'assault', 'support'];
const synthetic = (id, values = {}) => ({
  id, name: id, village: VILLAGES[0].id, tags: [], bond: null,
  stats: Object.fromEntries(STAT_KEYS.map((key) => [key, values[key] ?? 75])),
});
const sampleTeam = () => Object.fromEntries(ids.map((id) => [id, synthetic(id)]));
const characterId = ninja => ninja.baseCharacterId ?? ninja.baseId ?? ninja.id;

test('seed hashing and RNG are deterministic, including zero and Unicode', () => {
  for (const seed of [0, 42, '木叶·第七班', 'daily:2026-11-09']) {
    const a = seededRandom(seed);
    const b = seededRandom(seed);
    const sequence = Array.from({ length: 50 }, () => a());
    assert.deepEqual(sequence, Array.from({ length: 50 }, () => b()));
    assert(sequence.every((value) => value >= 0 && value < 1));
    assert.equal(hashSeed(seed), hashSeed(seed));
    assert.equal(hashSeed(seed) >>> 0, hashSeed(seed));
  }
});

test('game draws contain four rounds plus two redraws and replay by seed', () => {
  const options = { seed: 'replay-this', date: '2026-11-09' };
  const game = createGame(options);
  assert.deepEqual(game, createGame(options));
  assert.equal(game.draws.length, 6);
  assert.equal(game.rulesVersion, 3);
  assert.equal(game.eras.length, game.draws.length);
  assert(game.draws.every((id) => VILLAGES.some((village) => village.id === id)));
  assert(game.draws.every((villageId, index) => DRAFT_POOLS.some(pool =>
    pool.villageId === villageId && pool.eraId === game.eras[index])));
  assert.equal(game.mode, 'free');
  assert.equal(game.day, '2026-11-09');
  assert.equal(typeof game.missionSeed, 'number');
  assert.throws(() => createGame({ mode: 'unknown' }), /模式/);
  assert.throws(() => createGame({ rulesVersion: 999 }), /规则版本/);
});

test('daily uses the Shanghai date and ignores a caller seed', () => {
  const a = createGame({ mode: 'daily', seed: 1, date: new Date('2026-11-08T16:00:00Z') });
  const b = createGame({ mode: 'daily', seed: 2, date: '2026-11-09' });
  assert.deepEqual(a, b);
  assert.notEqual(a.seed, createGame({ mode: 'daily', date: '2026-11-10' }).seed);
  assert.equal(createGame({ mode: 'daily', date: '2026-11-08T15:59:59Z' }).day, '2026-11-08');
  assert.throws(() => createGame({ date: '2026-02-30' }), /日期/);
});

test('simulation rejects incomplete, duplicate, and malformed teams', () => {
  const team = sampleTeam();
  assert.throws(() => simulateMissions({ ...team, support: null }, 1), /完整/);
  assert.throws(() => simulateMissions({ ...team, support: team.scout }, 1), /重复/);
  assert.throws(() => simulateMissions({ ...team, support: { ...team.support, baseCharacterId: 'same' },
    scout: { ...team.scout, baseCharacterId: 'same' } }, 1), /重复/);
  assert.throws(() => roleScore({ ...team.captain, stats: { nin: 90 } }, 'captain'), /八维/);
  assert.throws(() => roleScore(team.captain, 'unknown'), /职责/);
  assert.equal(evaluateTeam({}).roles.captain, 0);
});

test('all villages can fill a team and candidate pools exclude selected characters', () => {
  assert.deepEqual(VILLAGES.map((village) => village.id).sort(), ['cloud', 'leaf', 'mist', 'sand', 'stone']);
  assert.equal(new Set(NINJAS.map((ninja) => ninja.id)).size, NINJAS.length);
  for (const village of VILLAGES) {
    const candidates = getCandidates(village.id);
    assert(candidates.length >= 4, `${village.id} needs at least four distinct ninjas`);
    const team = {};
    for (const role of ids) {
      team[role] = getCandidates(village.id, team)[0];
      assert(team[role]);
    }
    assert.equal(new Set(Object.values(team).map((ninja) => ninja.id)).size, 4);
    assert(!getCandidates(village.id, team).some((ninja) => Object.values(team).includes(ninja)));
    assert.equal(simulateMissions(team, 'village-check').total, 20);
  }
});

test('each draw offers six unique unpicked ninjas, including four rounds in one village', () => {
  for (const village of VILLAGES) {
    const team = {};
    for (let round = 0; round < 4; round++) {
      const offer = drawCandidates(village.id, team, 'six-candidate-check', round);
      assert.equal(offer.length, 6);
      assert.equal(new Set(offer.map(ninja => ninja.id)).size, 6);
      assert(offer.every(ninja => ninja.village === village.id && !Object.values(team).includes(ninja)));
      team[ids[round]] = offer[0];
    }
    assert.equal(new Set(Object.values(team).map(ninja => ninja.id)).size, 4);
  }
  assert.throws(() => drawCandidates('leaf', {}, 'seed', -1), /序号/);
  assert.throws(() => drawCandidates('leaf', {}, 'seed', 6), /序号/);
});

test('candidate draws replay by seed, index and picks, sampling the full village pool', () => {
  for (const village of VILLAGES) {
    const selected = getCandidates(village.id).slice(0, 2);
    const team = { captain: selected[0], support: selected[1] };
    const offer = drawCandidates(village.id, team, 'replay-six', 2);
    assert.deepEqual(offer, drawCandidates(village.id, structuredClone(team), 'replay-six', 2));
    assert.deepEqual(offer, drawCandidates(village.id, { support: selected[1], captain: selected[0] }, 'replay-six', 2));
    const variants = new Set();
    const seen = new Set();
    for (let seed = 0; seed < 100; seed++) {
      const sample = drawCandidates(village.id, {}, seed, seed % 6);
      variants.add(sample.map(ninja => ninja.id).sort().join(','));
      sample.forEach(ninja => seen.add(ninja.id));
    }
    assert(variants.size > 1, `${village.id}: draws should vary`);
    assert.equal(seen.size, getCandidates(village.id).length, `${village.id}: full roster remains available`);
  }
  const game = createGame({ mode: 'daily', date: '2026-11-09' });
  assert.deepEqual(drawCandidates(game.draws[0], {}, game.seed, 0), drawCandidates(game.draws[0], {}, createGame({ mode: 'daily', date: '2026-11-09' }).seed, 0));
});

test('role fit matters for an identical eight-stat total', () => {
  assert.equal(ROLES.length, 4);
  const strategist = synthetic('strategist', { nin: 60, tai: 30, gen: 75, int: 100, str: 20, spd: 60, sta: 55, seal: 70 });
  const brawler = synthetic('brawler', { nin: 60, tai: 100, gen: 20, int: 30, str: 90, spd: 85, sta: 55, seal: 30 });
  assert.equal(Object.values(strategist.stats).reduce((a, b) => a + b), Object.values(brawler.stats).reduce((a, b) => a + b));
  assert(roleScore(strategist, 'captain') > roleScore(brawler, 'captain'));
  assert(roleScore(brawler, 'assault') > roleScore(strategist, 'assault'));
});

test('expanded roster has complete, distinct profiles and valid fit for every role', () => {
  const allowedTraits = new Set(['medical', 'sensor', 'tactics', 'seal', 'guard', 'ranged', 'assault', 'stealth']);
  assert.equal(NINJAS.length, 85, 'the original character archive remains available');
  assert.equal(new Set(NINJAS.map(ninja => ninja.name)).size, NINJAS.length);
  for (const village of VILLAGES) assert(getCandidates(village.id).length >= 10, `${village.id} needs a varied roster`);
  for (const ninja of NINJAS) {
    assert(VILLAGES.some(village => village.id === ninja.village), `${ninja.name}: village`);
    for (const field of ['id', 'name', 'alias', 'version', 'specialty']) assert.equal(typeof ninja[field], 'string', `${ninja.name}: ${field}`);
    assert.equal(typeof ninja.rogue, 'boolean');
    assert(ninja.tags.every(tag => allowedTraits.has(tag)), `${ninja.name}: trait`);
    for (const key of STAT_KEYS) assert(Number.isInteger(ninja.stats[key]) && ninja.stats[key] >= 0 && ninja.stats[key] <= 100, `${ninja.name}: ${key}`);
    for (const role of ids) assert(Number.isFinite(roleScore(ninja, role)), `${ninja.name}: ${role}`);
  }
});

test('period versions retain valid identities and every draft pool has nine distinct characters', () => {
  assert(ERAS.length > 1);
  assert.equal(new Set(ERAS.map(era => era.id)).size, ERAS.length);
  for (const era of ERAS) {
    for (const field of ['id', 'name', 'shortName', 'description']) {
      assert.equal(typeof era[field], 'string', `${era.id}: ${field}`);
      assert(era[field].length > 0, `${era.id}: ${field} must be present`);
    }
  }
  assert.equal(new Set(NINJA_VERSIONS.map(ninja => ninja.id)).size, NINJA_VERSIONS.length);
  for (const ninja of NINJA_VERSIONS) {
    assert(NINJAS.some(base => base.id === ninja.baseCharacterId), `${ninja.id}: original identity`);
    assert(ERAS.some(era => era.id === ninja.eraId), `${ninja.id}: period`);
    assert.equal(ninja.id, `${ninja.baseCharacterId}@${ninja.eraId}`);
    for (const key of STAT_KEYS) {
      assert(Number.isInteger(ninja.stats[key]) && ninja.stats[key] >= 0 && ninja.stats[key] <= 100, `${ninja.id}: ${key}`);
    }
    for (const role of ids) assert(Number.isFinite(roleScore(ninja, role)), `${ninja.id}: ${role}`);
  }
  assert.equal(new Set(DRAFT_POOLS.map(pool => `${pool.villageId}@${pool.eraId}`)).size, DRAFT_POOLS.length);
  for (const pool of DRAFT_POOLS) {
    const label = `${pool.villageId}@${pool.eraId}`;
    assert(VILLAGES.some(village => village.id === pool.villageId), `${label}: village`);
    assert(ERAS.some(era => era.id === pool.eraId), `${label}: period`);
    const candidates = getCandidates(pool.villageId, {}, pool.eraId);
    const identities = new Set(candidates.map(characterId));
    assert.equal(identities.size, candidates.length, `${label}: one version per character`);
    assert(identities.size >= 9, `${label}: enough characters for six offers after three picks`);
  }
  assert.throws(() => getCandidates('leaf', {}, 'unknown-period'), /时期/);
  assert.throws(() => drawCandidates('leaf', {}, 'seed', 0, 'unknown-period'), /时期/);
});

test('every period pool offers six distinct identities through four consecutive rounds', () => {
  for (const { villageId, eraId } of DRAFT_POOLS) {
    const team = {};
    for (let round = 0; round < 4; round++) {
      const offer = drawCandidates(villageId, team, 'four-period-rounds', round, eraId);
      const selected = new Set(Object.values(team).map(characterId));
      assert.equal(offer.length, 6, `${villageId}@${eraId}: round ${round + 1}`);
      assert.equal(new Set(offer.map(characterId)).size, 6);
      assert(offer.every(ninja => ninja.village === villageId && ninja.eraId === eraId && !selected.has(characterId(ninja))));
      assert.deepEqual(offer, drawCandidates(villageId, structuredClone(team), 'four-period-rounds', round, eraId));
      team[ids[round]] = offer[0];
    }
    assert.equal(new Set(Object.values(team).map(characterId)).size, 4);
    assert.equal(simulateMissions(team, 'period-complete-team').total, 20);
  }
});

test('picking a character excludes every period version and the original archive entry', () => {
  const versionsByCharacter = new Map();
  for (const ninja of NINJA_VERSIONS) {
    const versions = versionsByCharacter.get(ninja.baseCharacterId) ?? [];
    versions.push(ninja);
    versionsByCharacter.set(ninja.baseCharacterId, versions);
  }
  let crossPeriodChecks = 0;
  for (const [baseId, versions] of versionsByCharacter) {
    const original = NINJAS.find(ninja => ninja.id === baseId);
    const selectedVersion = versions[0];
    assert(!getCandidates(original.village, { captain: selectedVersion }).some(ninja => characterId(ninja) === baseId));
    for (const version of versions) {
      for (const selected of [original, selectedVersion]) {
        const team = { captain: selected };
        assert(!getCandidates(version.village, team, version.eraId).some(ninja => characterId(ninja) === baseId));
        assert(!drawCandidates(version.village, team, 'cross-period', 1, version.eraId).some(ninja => characterId(ninja) === baseId));
      }
    }
    if (versions.length > 1) {
      crossPeriodChecks++;
      assert.throws(() => simulateMissions({ ...sampleTeam(), captain: versions[0], support: versions[1] }, 'duplicate-versions'), /重复/);
    }
  }
  assert(crossPeriodChecks > 0, 'some characters must have more than one period version');
});

test('story period draws replay by seed and support every current village-period combination', () => {
  const observedPools = new Set();
  const observedEraSequences = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const options = { seed: `period-replay-${seed}`, date: '2026-11-10' };
    const game = createGame(options);
    assert.deepEqual(game, createGame(options));
    assert.equal(game.rulesVersion, 3);
    assert.equal(game.eras.length, 6);
    observedEraSequences.add(game.eras.join(','));
    const team = {};
    game.draws.forEach((villageId, index) => {
      const eraId = game.eras[index];
      assert.notEqual(eraId, 'legacy', 'current draws use story periods');
      if (index > 0) assert.notEqual(eraId, game.eras[index - 1], 'story periods do not repeat consecutively');
      assert(DRAFT_POOLS.some(pool => pool.villageId === villageId && pool.eraId === eraId));
      observedPools.add(`${villageId}@${eraId}`);
      const offer = drawCandidates(villageId, team, game.seed, index, eraId);
      assert.equal(offer.length, 6);
      assert(offer.every(ninja => ninja.village === villageId && ninja.eraId === eraId));
      assert.deepEqual(offer, drawCandidates(villageId, structuredClone(team), game.seed, index, eraId));
      if (index < 3) team[ids[index]] = offer[0];
    });
  }
  assert(observedEraSequences.size > 1);
  for (const pool of DRAFT_POOLS.filter(pool => pool.eraId !== 'legacy')) {
    assert(observedPools.has(`${pool.villageId}@${pool.eraId}`), 'current story pools remain reachable');
  }
  const daily = createGame({ mode: 'daily', seed: 'ignored', date: '2026-11-10' });
  const replay = createGame({ mode: 'daily', date: '2026-11-10' });
  assert.deepEqual(daily.eras, replay.eras);
  assert.deepEqual(drawCandidates(daily.draws[0], {}, daily.seed, 0, daily.eras[0]),
    drawCandidates(replay.draws[0], {}, replay.seed, 0, replay.eras[0]));
});

test('current story periods are balanced over many seeds and never repeat consecutively', () => {
  const storyIds = ['chunin', 'akatsuki', 'summit', 'war'];
  const counts = Object.fromEntries(storyIds.map(id => [id, 0]));
  const firstCounts = { ...counts };
  const trials = 5000;
  for (let seed = 0; seed < trials; seed++) {
    const game = createGame({ seed: `era-distribution-${seed}`, date: '2026-11-10' });
    assert.equal(game.rulesVersion, 3);
    game.eras.forEach((eraId, index) => {
      assert(storyIds.includes(eraId), 'legacy is an archive, not a current story draw');
      if (index > 0) assert.notEqual(eraId, game.eras[index - 1]);
      assert(DRAFT_POOLS.some(pool => pool.villageId === game.draws[index] && pool.eraId === eraId));
      counts[eraId]++;
      if (index === 0) firstCounts[eraId]++;
    });
  }
  for (const eraId of storyIds) {
    assert(Math.abs(counts[eraId] / (trials * 6) - 0.25) < 0.015, `${eraId}: all positions stay near 25%`);
    assert(Math.abs(firstCounts[eraId] / trials - 0.25) < 0.025, `${eraId}: opening draws stay near 25%`);
  }
});

test('legacy rules preserve the original village and period sequences and reachable perfect draft', () => {
  const options = { seed: 'calibration-192', date: '2026-11-09', rulesVersion: 2 };
  const game = createGame(options);
  assert.deepEqual(game, createGame(options));
  assert.equal(game.rulesVersion, 2);
  assert.deepEqual(game.draws, ['leaf', 'stone', 'cloud', 'sand', 'stone', 'leaf']);
  assert.deepEqual(game.eras, ['chunin', 'war', 'legacy', 'legacy', 'legacy', 'akatsuki']);
  assert.equal(game.missionSeed, 2478238833);
  const desired = ['orochimaru@chunin', 'mu@war', 'ay@legacy', 'sasori@legacy'];
  const team = {};
  ROLES.forEach((role, index) => {
    const offer = drawCandidates(game.draws[index], team, game.seed, index, game.eras[index]);
    assert.equal(offer.length, 6);
    const pick = offer.find(ninja => ninja.id === desired[index]);
    assert(pick, `${desired[index]}: original shared challenge still offers this pick`);
    team[role.id] = pick;
  });
  assert.equal(simulateMissions(team, game.missionSeed).wins, 20);
  const daily = createGame({ mode: 'daily', date: '2026-11-10', rulesVersion: 2 });
  assert.deepEqual(daily, createGame({ mode: 'daily', seed: 'ignored', date: '2026-11-10', rulesVersion: 2 }));
});

test('Naruto and Sakura gain period-specific skills and corresponding role fit', () => {
  const version = (baseId, eraId) => {
    const ninja = NINJA_VERSIONS.find(entry => entry.baseCharacterId === baseId && entry.eraId === eraId);
    assert(ninja, `${baseId}@${eraId}: required story profile`);
    return ninja;
  };
  const earlyNaruto = version('naruto', 'chunin');
  const sageNaruto = version('naruto', 'akatsuki');
  const warNaruto = version('naruto', 'war');
  assert(!earlyNaruto.tags.includes('sensor'));
  assert(sageNaruto.tags.includes('sensor'));
  assert(warNaruto.tags.includes('sensor'));
  for (const key of ['nin', 'tai', 'spd', 'seal']) {
    assert(earlyNaruto.stats[key] < sageNaruto.stats[key], `Naruto: ${key} after training`);
    assert(sageNaruto.stats[key] < warNaruto.stats[key], `Naruto: ${key} in the war`);
  }
  assert(roleScore(warNaruto, 'scout') > roleScore(earlyNaruto, 'scout') + 20);
  assert(roleScore(warNaruto, 'assault') > roleScore(earlyNaruto, 'assault') + 20);
  assert.equal(roleScore(sageNaruto, 'scout') - roleScore({ ...sageNaruto, tags: sageNaruto.tags.filter(tag => tag !== 'sensor') }, 'scout'), 12);

  const earlySakura = version('sakura', 'chunin');
  const medicSakura = version('sakura', 'akatsuki');
  const warSakura = version('sakura', 'war');
  assert(!earlySakura.tags.includes('medical'));
  assert(medicSakura.tags.includes('medical'));
  assert(warSakura.tags.includes('medical'));
  assert(earlySakura.stats.str < medicSakura.stats.str);
  assert(medicSakura.stats.sta < warSakura.stats.sta);
  assert(medicSakura.stats.seal < warSakura.stats.seal);
  assert(roleScore(medicSakura, 'support') > roleScore(earlySakura, 'support') + 20);
  assert(roleScore(warSakura, 'support') > roleScore(medicSakura, 'support'));
  assert.equal(roleScore(medicSakura, 'support') - roleScore({ ...medicSakura, tags: medicSakura.tags.filter(tag => tag !== 'medical') }, 'support'), 8);
});

test('period specialization changes tags without applying a universal growth multiplier', () => {
  const version = (baseId, eraId) => NINJA_VERSIONS.find(entry => entry.baseCharacterId === baseId && entry.eraId === eraId);
  const earlyIno = version('ino', 'chunin');
  const warIno = version('ino', 'war');
  assert(!earlyIno.tags.includes('medical') && !earlyIno.tags.includes('sensor'));
  assert(warIno.tags.includes('medical') && warIno.tags.includes('sensor'));
  assert.equal(roleScore(warIno, 'scout') - roleScore({ ...warIno, tags: warIno.tags.filter(tag => tag !== 'sensor') }, 'scout'), 12);
  assert.equal(roleScore(warIno, 'support') - roleScore({ ...warIno, tags: warIno.tags.filter(tag => tag !== 'medical') }, 'support'), 8);

  const earlySai = version('sai', 'akatsuki');
  const warSai = version('sai', 'war');
  assert(!earlySai.tags.includes('seal'));
  assert(warSai.tags.includes('seal'));
  assert.equal(roleScore(warSai, 'support') - roleScore({ ...warSai, tags: warSai.tags.filter(tag => tag !== 'seal') }, 'support'), 4);

  const healthyOrochimaru = version('orochimaru', 'chunin');
  const sealedOrochimaru = version('orochimaru', 'akatsuki');
  for (const key of ['nin', 'sta', 'seal']) assert(healthyOrochimaru.stats[key] > sealedOrochimaru.stats[key]);
  assert.equal(healthyOrochimaru.stats.int, sealedOrochimaru.stats.int);
  assert(roleScore(healthyOrochimaru, 'support') > roleScore(sealedOrochimaru, 'support'));

  const earlySasuke = version('sasuke', 'akatsuki');
  const summitSasuke = version('sasuke', 'summit');
  assert(summitSasuke.stats.gen > earlySasuke.stats.gen);
  assert(summitSasuke.stats.sta < earlySasuke.stats.sta, 'new eye techniques retain their stamina tradeoff');
  const earlyTenten = version('tenten', 'akatsuki');
  const warTenten = version('tenten', 'war');
  assert(warTenten.stats.nin > earlyTenten.stats.nin);
  assert(warTenten.stats.sta < earlyTenten.stats.sta, 'new weapons do not grant unlimited stamina');
  assert.deepEqual(version('guy', 'chunin').stats, version('guy', 'akatsuki').stats, 'mature abilities need not rise in every period');
});

test('a reachable six-candidate period draft can still complete all twenty missions', () => {
  const game = createGame({ seed: 'calibration-18', date: '2026-11-09' });
  assert.equal(game.rulesVersion, 3);
  const desired = ['orochimaru@chunin', 'obito@akatsuki', 'naruto@summit', 'tsunade@akatsuki'];
  const team = {};
  ROLES.forEach((role, index) => {
    const offer = drawCandidates(game.draws[index], team, game.seed, index, game.eras[index]);
    assert.equal(offer.length, 6);
    const pick = offer.find(ninja => ninja.id === desired[index]);
    assert(pick, `${desired[index]} must be reachable in round ${index + 1}`);
    team[role.id] = pick;
  });
  assert.equal(new Set(Object.values(team).map(characterId)).size, 4);
  assert.equal(simulateMissions(team, game.missionSeed).wins, 20);
});

test('canon-inspired specialties affect only relevant role fit and respect the ceiling', () => {
  const base = synthetic('ordinary');
  const sensor = { ...base, tags: ['sensor'] };
  const medic = { ...base, tags: ['medical'] };
  assert.equal(roleScore(sensor, 'scout'), roleScore(base, 'scout') + 12);
  assert.equal(roleScore(sensor, 'captain'), roleScore(base, 'captain'));
  assert.equal(roleScore(medic, 'support'), roleScore(base, 'support') + 8);
  assert.equal(roleScore(medic, 'assault'), roleScore(base, 'assault'));
  const allTraits = { ...synthetic('all', Object.fromEntries(STAT_KEYS.map(key => [key, 99]))), tags: ['sensor', 'medical', 'seal', 'guard', 'stealth', 'tactics', 'assault', 'ranged'] };
  for (const role of ids) assert.equal(roleScore(allTraits, role), 100);
});

test('mission types vary by seed with unique matching names, fixed replay and slightly higher difficulty', () => {
  const types = ['潜入', '追踪', '强袭', '护送'];
  const previousDifficulties = [40, 44, 48, 52, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 82, 85, 89, 93];
  const counts = new Set();
  const nameTypes = new Map();
  for (let seed = 0; seed < 100; seed++) {
    const plan = createMissionPlan(seed);
    assert.deepEqual(plan, createMissionPlan(seed));
    assert.equal(plan.length, 20);
    assert.equal(new Set(plan.map(m => m.id)).size, 20);
    assert.equal(new Set(plan.map(m => m.name)).size, 20);
    counts.add(types.map(type => plan.filter(m => m.type === type).length).join(','));
    plan.forEach((mission, index) => {
      assert(types.includes(mission.type));
      assert(ids.includes(mission.role));
      assert.equal(mission.difficulty, previousDifficulties[index] + 2);
      const name = mission.name.split(' · ')[0];
      if (nameTypes.has(name)) assert.equal(nameTypes.get(name), mission.type);
      nameTypes.set(name, mission.type);
    });
  }
  assert(counts.size > 1, 'type counts must vary instead of always being five each');
});

test('mission type weighting makes the main role matter more and team changes cannot reroll the plan', () => {
  const baseline = simulateMissions(sampleTeam(), 'types');
  const focusTypes = { captain: '追踪', scout: '潜入', assault: '强袭', support: '护送' };
  const fixedFields = mission => [mission.id, mission.name, mission.type, mission.role, mission.difficulty, mission.luck];
  for (const [role, focus] of Object.entries(focusTypes)) {
    const weaker = sampleTeam();
    weaker[role] = synthetic(role, Object.fromEntries(STAT_KEYS.map(key => [key, 45])));
    const result = simulateMissions(weaker, 'types');
    assert.deepEqual(result.missions.map(fixedFields), baseline.missions.map(fixedFields));
    const losses = Object.fromEntries(result.missions.map((mission, index) => [mission.type, baseline.missions[index].score - mission.score]));
    assert.equal(Object.keys(losses).length, 4);
    for (const type of Object.keys(losses)) if (type !== focus) assert(losses[focus] > losses[type], `${role} should matter most for ${focus}`);
  }
});

test('twenty missions and analysis replay exactly, independently of object key order', () => {
  const team = sampleTeam();
  const result = simulateMissions(team, 'report');
  assert.deepEqual(result, simulateMissions(team, 'report'));
  assert.deepEqual(result, simulateMissions(Object.fromEntries(Object.entries(team).reverse()), 'report'));
  assert.equal(result.wins + result.losses, 20);
  assert.equal(result.missions.length, 20);
  assert.equal(new Set(result.missions.map((mission) => mission.id)).size, 20);
  assert.equal(result.wins, result.missions.filter((mission) => mission.success).length);
  for (const mission of result.missions) {
    assert(mission.luck >= -4 && mission.luck <= 4);
    assert.equal(mission.success, mission.score + mission.luck >= mission.difficulty);
    assert(mission.reason.length > 0);
    assert(ids.includes(mission.role));
  }
});

test('raising any single attribute cannot lower a mission score or turn a success into failure', () => {
  const original = sampleTeam();
  original.captain.stats.int = 48;
  original.scout.stats.spd = 52;
  original.assault.stats.sta = 49;
  original.support.stats.seal = 50;
  for (const seed of [0, 'fixed-luck', 'daily']) {
    const baseline = simulateMissions(original, seed);
    for (const role of ids) {
      for (const stat of STAT_KEYS) {
        const improved = structuredClone(original);
        improved[role].stats[stat] = Math.min(100, improved[role].stats[stat] + 20);
        const result = simulateMissions(improved, seed);
        assert(result.wins >= baseline.wins, `${role}/${stat}`);
        result.missions.forEach((mission, index) => {
          assert(mission.score >= baseline.missions[index].score, `${role}/${stat}/${mission.id}`);
          assert(!baseline.missions[index].success || mission.success);
          assert.equal(mission.luck, baseline.missions[index].luck);
        });
      }
    }
  }
});

test('bond synergy is bounded and perfect runs remain achievable', () => {
  const team = sampleTeam();
  for (const ninja of Object.values(team)) {
    ninja.bond = '并肩作战';
    for (const key of STAT_KEYS) ninja.stats[key] = 100;
  }
  const result = simulateMissions(team, 'elite');
  assert.equal(result.wins, 20);
  assert(result.analysis.synergy <= 4);
  assert.equal(result.analysis.bonds[0].name, '并肩作战');
});

test('a strong team from the actual character pool can achieve twenty successes', () => {
  const characters = { captain: 'itachi', scout: 'sasuke', assault: 'ay', support: 'jiraiya' };
  const team = Object.fromEntries(ids.map((role) => [role, NINJAS.find((ninja) => ninja.id === characters[role])]));
  const wins = Array.from({ length: 100 }, (_, seed) => simulateMissions(team, seed).wins);
  assert.equal(Math.max(...wins), 20);
  assert(Math.min(...wins) >= 18);
});
