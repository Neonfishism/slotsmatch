import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLeaderboardStore } from '../server/leaderboard.js';
import { createAppServer } from '../server/index.js';
import { createGame, drawCandidates, gameAtRound, simulateWorlds2026 } from '../src/worlds/engine.js';

const DEVICE_A = '7c92d354-66af-4f6f-a549-24b7228da5b5';
const DEVICE_B = 'e7207e51-c304-4b6b-b8a1-bdf614689518';
const NOW = '2026-11-10T10:00:00.000Z';
const slots = ['top', 'jungle', 'mid', 'adc', 'support', 'bench'];

function draft(run, deviceId) {
  const team = {};
  const actions = [];
  for (let round = 0; round < 6; round++) {
    const candidates = drawCandidates(gameAtRound(run.game, round), team, round);
    const player = candidates.find(player => player.role === slots[round]) || candidates[0];
    team[slots[round]] = player.id;
    actions.push({ playerId: player.id, drawIndex: round });
  }
  return { runId: run.runId, actions, team, ...(deviceId && { deviceId }) };
}

function memoryStore(t) {
  const store = createLeaderboardStore({ dbPath: ':memory:', now: () => new Date(NOW) });
  t.after(() => store.close());
  return store;
}

function tempDatabase(t) {
  const folder = mkdtempSync(join(tmpdir(), 'worlds-devices-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return join(folder, 'worlds.sqlite');
}

test('device statistics group renamed teams and separate devices sharing a team name', t => {
  const store = memoryStore(t);
  const empty = store.stats();
  assert.equal(empty.totals.averageSubmissionsPerDevice, 0);
  assert.equal(empty.totals.totalSubmissions, 0);
  assert.equal(empty.pagination.totalPages, 1);
  for (const [teamName, deviceId] of [['同名队', DEVICE_A], ['改名队', DEVICE_A.toUpperCase()], ['同名队', DEVICE_B]]) {
    const run = store.createRun({ teamName, deviceId });
    store.submit(draft(run, deviceId));
  }
  store.createRun({ teamName: '尚未提交', deviceId: DEVICE_B });
  const stats = store.stats();
  assert.deepEqual(stats.totals, { totalSubmissions: 3, identifiedSubmissions: 3, unattributedSubmissions: 0, uniqueDevices: 2, averageSubmissionsPerDevice: 1.5, totalRuns: 4 });
  assert.deepEqual(stats.players.map(player => player.submissions), [2, 1]);
  assert.deepEqual(new Set(stats.players[0].teamNames), new Set(['同名队', '改名队']));
  assert.equal(stats.players[0].firstSubmissionAt, NOW);
  assert.equal(stats.players[0].lastSubmissionAt, NOW);
  assert.equal(stats.pagination.totalPlayers, 2);
  assert.equal(stats.updatedAt, NOW);
  const serialized = JSON.stringify(stats);
  assert(!serialized.includes(DEVICE_A));
  assert(!serialized.includes(createHash('sha256').update(DEVICE_A).digest('hex')));
  assert.match(stats.players[0].deviceLabel, /^玩家-[a-f0-9]{12}$/);
  assert.deepEqual(store.stats({ page: 2, pageSize: 1 }).players, [stats.players[1]]);
  assert.equal(store.stats({ page: 3, pageSize: 1 }).players.length, 0);
});

test('successful first submissions attach unfinished legacy runs; duplicate submissions never inflate or reassign counts', t => {
  const store = memoryStore(t);
  const legacy = store.createRun({ teamName: '旧版已结算队' });
  const legacyRequest = draft(legacy);
  store.submit(legacyRequest);
  assert.equal(store.submit({ ...legacyRequest, deviceId: DEVICE_A }).duplicate, true);
  assert.equal(store.stats().totals.unattributedSubmissions, 1);
  assert.equal(store.stats().totals.uniqueDevices, 0);

  const unfinished = store.createRun({ teamName: '旧版未结算队' });
  const request = draft(unfinished, DEVICE_A);
  assert.throws(() => store.submit({ ...request, actions: [] }), /六轮/);
  assert.equal(store.stats().totals.identifiedSubmissions, 0);
  store.submit(request);
  assert.equal(store.submit(request).duplicate, true);
  assert.throws(() => store.submit({ ...request, deviceId: DEVICE_B }), error => error.status === 403);
  // Older clients without a device field still retry their own run capability.
  assert.equal(store.submit(draft(unfinished)).duplicate, true);
  assert.deepEqual(store.stats().totals, { totalSubmissions: 2, identifiedSubmissions: 1, unattributedSubmissions: 1, uniqueDevices: 1, averageSubmissionsPerDevice: 1, totalRuns: 2 });
});

test('invalid or changed device identifiers cannot corrupt run attribution', t => {
  const store = memoryStore(t);
  for (const deviceId of ['', null, {}, 'hardware-serial', '7c92d354-66af-1f6f-a549-24b7228da5b5', 'a'.repeat(200)]) {
    assert.throws(() => store.createRun({ teamName: '无效设备', deviceId }), error => error.status === 400);
  }
  const run = store.createRun({ teamName: '设备绑定队', deviceId: DEVICE_A });
  const request = draft(run, DEVICE_B);
  assert.throws(() => store.submit(request), error => error.status === 403);
  assert.throws(() => store.submit({ ...request, deviceId: 'bad-id' }), error => error.status === 400);
  assert.equal(store.stats().totals.totalSubmissions, 0);
  store.submit(draft(run));
  assert.equal(store.stats().totals.uniqueDevices, 1);
  for (const options of [{ page: 0 }, { page: 1.5 }, { page: 1000001 }, { pageSize: 0 }, { pageSize: 101 }, { pageSize: NaN }]) assert.throws(() => store.stats(options), error => error.status === 400);
});

test('migration preserves the exact old schema data, leaves history unattributed and persists hashed new device IDs', t => {
  const dbPath = tempDatabase(t);
  const old = new DatabaseSync(dbPath);
  old.exec(`CREATE TABLE runs (id TEXT PRIMARY KEY, team_name TEXT NOT NULL, game_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE entries (id TEXT PRIMARY KEY, run_id TEXT UNIQUE NOT NULL REFERENCES runs(id),
      team_name TEXT NOT NULL, placement TEXT NOT NULL, placement_rank INTEGER NOT NULL,
      wins INTEGER NOT NULL, losses INTEGER NOT NULL, series_wins INTEGER NOT NULL, series_losses INTEGER NOT NULL,
      team_rating REAL NOT NULL, region_id TEXT NOT NULL, created_at TEXT NOT NULL,
      result_json TEXT NOT NULL, team_json TEXT NOT NULL, actions_json TEXT NOT NULL);`);
  const run = { runId: 'old-run', game: createGame({ seed: 'pre-device-migration' }) };
  const request = draft(run);
  const result = simulateWorlds2026(gameAtRound(run.game, 5), request.team);
  old.prepare('INSERT INTO runs VALUES(?,?,?,?)').run(run.runId, '历史战队', JSON.stringify(run.game), NOW);
  old.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('old-entry', run.runId, '历史战队', result.placement, result.rank, result.record.wins, result.record.losses, result.seriesRecord.wins, result.seriesRecord.losses, result.rating, result.regionId, NOW, JSON.stringify(result), JSON.stringify(request.team), JSON.stringify(request.actions));
  const oldEntry = { ...old.prepare('SELECT * FROM entries').get() };
  old.close();
  let store = createLeaderboardStore({ dbPath });
  assert.equal(store.stats().totals.unattributedSubmissions, 1);
  store.submit({ ...request, deviceId: DEVICE_A });
  assert.equal(store.stats().totals.unattributedSubmissions, 1);
  const modern = store.createRun({ teamName: '新设备队', deviceId: DEVICE_A });
  store.submit(draft(modern, DEVICE_A));
  store.close();
  store = createLeaderboardStore({ dbPath });
  assert.equal(store.stats().totals.totalSubmissions, 2);
  assert.equal(store.stats().totals.identifiedSubmissions, 1);
  store.close();
  const inspect = new DatabaseSync(dbPath, { readOnly: true });
  assert.deepEqual({ ...inspect.prepare('SELECT * FROM entries WHERE id = ?').get('old-entry') }, oldEntry);
  assert.equal(inspect.prepare('SELECT device_id FROM runs WHERE id = ?').get(run.runId).device_id, null);
  assert.equal(inspect.prepare('SELECT device_id FROM runs WHERE id = ?').get(modern.runId).device_id, createHash('sha256').update(DEVICE_A).digest('hex'));
  inspect.close();
});

test('failure to attach an older run rolls back the new submission as one atomic operation', t => {
  const dbPath = tempDatabase(t);
  const store = createLeaderboardStore({ dbPath });
  const run = store.createRun({ teamName: '事务队' });
  const inspect = new DatabaseSync(dbPath);
  inspect.exec("CREATE TRIGGER reject_device BEFORE UPDATE OF device_id ON runs BEGIN SELECT RAISE(ABORT, 'test rejection'); END;");
  assert.throws(() => store.submit(draft(run, DEVICE_A)), /test rejection/);
  assert.equal(store.stats().totals.totalSubmissions, 0);
  assert.equal(inspect.prepare('SELECT device_id FROM runs WHERE id = ?').get(run.runId).device_id, null);
  inspect.exec('DROP TRIGGER reject_device');
  store.submit(draft(run, DEVICE_A));
  assert.equal(store.stats().totals.identifiedSubmissions, 1);
  inspect.close();
  store.close();
});

test('HTTP statistics expose anonymous counts with validated pagination and no reusable device identifiers', async t => {
  const store = memoryStore(t);
  const server = createAppServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamName: '网络设备队', deviceId: DEVICE_A }) });
  const run = await created.json();
  const published = await fetch(`${base}/api/leaderboard`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft(run, DEVICE_A)) });
  assert.equal(published.status, 201);
  const response = await fetch(`${base}/api/stats?page=1&pageSize=1`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const stats = await response.json();
  assert.equal(stats.totals.totalSubmissions, 1);
  assert.equal(stats.players[0].submissions, 1);
  assert.deepEqual(stats.players[0].teamNames, ['网络设备队']);
  assert(!JSON.stringify(stats).includes(DEVICE_A));
  for (const query of ['page=0', 'page=abc', 'pageSize=101', 'pageSize=1.5']) assert.equal((await fetch(`${base}/api/stats?${query}`)).status, 400);
});
