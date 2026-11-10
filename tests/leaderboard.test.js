import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createLeaderboardStore, validTeamName } from '../server/leaderboard.js';
import { createAppServer } from '../server/index.js';
import { PLAYERS } from '../src/worlds/data.js';
import { drawCandidates, gameAtRound, simulateWorlds2026 } from '../src/worlds/engine.js';

const SLOTS = ['top', 'jungle', 'mid', 'adc', 'support', 'bench'];
function draft(run, rerolls = {}) {
  const team = {};
  const actions = [];
  let rerollCount = 0;
  for (let round = 0; round < 6; round++) {
    rerollCount += rerolls[round] || 0;
    const drawIndex = round + rerollCount;
    const choices = drawCandidates(gameAtRound(run.game, round), team, drawIndex);
    const player = choices.find(player => player.role === SLOTS[round]) || choices[0];
    team[SLOTS[round]] = player.id;
    actions.push({ playerId: player.id, drawIndex });
  }
  return { runId: run.runId, actions, team };
}

function memoryStore(t) {
  const store = createLeaderboardStore({ dbPath: ':memory:', now: () => new Date('2026-11-10T00:00:00Z') });
  t.after(() => store.close());
  return store;
}

test('online runs require an intentional valid name and preserve shared seeds and Shanghai daily dates', t => {
  const store = memoryStore(t);
  for (const name of ['', '   ', 'a'.repeat(17), '冠军\n队', '\u202e冠军', null]) assert.throws(() => store.createRun({ teamName: name }), /名称|命名/);
  assert.equal(validTeamName('  星火战队  '), '星火战队');
  assert.equal(validTeamName('🦊'.repeat(16)), '🦊'.repeat(16));
  const a = store.createRun({ teamName: '星火战队', seed: 'shared-challenge' });
  const b = store.createRun({ teamName: '另一队', seed: 'shared-challenge' });
  assert.notEqual(a.runId, b.runId);
  assert.deepEqual(a.game, b.game);
  assert.equal(a.game.rulesVersion, 2);
  const daily = store.createRun({ teamName: '每日队', mode: 'daily' });
  assert.equal(daily.game.seed, 'worlds-daily:2026-11-10');
  assert.equal(store.createRun({ teamName: '昨日队', mode: 'daily', seed: 'worlds-daily:2026-11-09' }).game.day, '2026-11-09');
  assert.throws(() => store.createRun({ teamName: '坏日期', mode: 'daily', seed: 'worlds-daily:2026-02-30' }), /日期/);
  assert.throws(() => store.createRun({ teamName: '坏种子', seed: '' }), /种子/);
  assert.throws(() => store.createRun({ teamName: '坏模式', mode: 'nope' }), /模式/);
});

test('server verifies six actual regional draws, allows valid rerolls and final swaps, and calculates its own 2026 result', t => {
  const store = memoryStore(t);
  const run = store.createRun({ teamName: '跨季梦之队', seed: 'verified-six-rounds' });
  const request = draft(run, { 0: 1, 3: 1 });
  [request.team.top, request.team.mid] = [request.team.mid, request.team.top];
  request.result = { rank: 1, placement: '冠军', rating: 999, record: { wins: 1000, losses: 0 } };
  const expected = simulateWorlds2026(gameAtRound(run.game, 5), request.team);
  const response = store.submit(request);
  assert.equal(response.duplicate, false);
  assert.deepEqual(response.result, expected);
  assert.equal(response.entry.teamName, '跨季梦之队');
  assert.equal(response.entry.placementRank, expected.rank);
  assert.equal(response.entry.wins, expected.record.wins);
  assert.equal(response.entry.teamRating, expected.rating);
  assert.equal(response.entry.seasonId, '2026');
  assert.equal(response.entry.rank, 1);
  assert.equal(store.list().total, 1);
  assert(!('runId' in store.list().entries[0]), 'leaderboard does not expose the run write credential');
});

test('forged candidates, lost signing actions, excess rerolls and substituted final players cannot enter the shared ranking', t => {
  const store = memoryStore(t);
  const run = store.createRun({ teamName: '公平队', seed: 'verify-forgery' });
  const request = draft(run);
  const notOffered = PLAYERS.find(player => !drawCandidates(run.game, {}, 0).some(offered => offered.id === player.id));
  const forged = structuredClone(request);
  forged.actions[0].playerId = notOffered.id;
  assert.throws(() => store.submit(forged), /候选/);
  assert.throws(() => store.submit({ ...request, actions: request.actions.slice(1) }), /六轮/);
  const extraReroll = structuredClone(request);
  extraReroll.actions[0].drawIndex = 3;
  assert.throws(() => store.submit(extraReroll), /次数/);
  const repeatedDraw = structuredClone(request);
  repeatedDraw.actions[1].drawIndex = 0;
  assert.throws(() => store.submit(repeatedDraw), /次数/);
  const substituted = structuredClone(request);
  substituted.team.top = notOffered.id;
  assert.throws(() => store.submit(substituted), /一致/);
  assert.throws(() => store.submit({ ...request, runId: 'unknown-run' }), /登记/);
  assert.equal(store.list().total, 0);
  const daily = store.createRun({ teamName: '每日公平队', mode: 'daily' });
  assert.throws(() => store.submit(draft(daily, { 1: 1 })), /次数/);
});

test('duplicate settlement is idempotent, while changing an already published lineup is rejected', t => {
  const store = memoryStore(t);
  const run = store.createRun({ teamName: '只算一次', seed: 'idempotent' });
  const request = draft(run);
  const first = store.submit(request);
  const second = store.submit(structuredClone(request));
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.entry, first.entry);
  assert.deepEqual(second.result, first.result);
  assert.equal(store.list().total, 1);
  [request.team.top, request.team.mid] = [request.team.mid, request.team.top];
  assert.throws(() => store.submit(request), error => error.status === 409);
});

test('all players share a persistent ranking ordered by placement, map wins, losses and team rating', t => {
  const folder = mkdtempSync(join(tmpdir(), 'worlds-leaderboard-'));
  const dbPath = join(folder, 'rank.sqlite');
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let store = createLeaderboardStore({ dbPath });
  const submitted = [];
  for (let index = 0; index < 14; index++) {
    const run = store.createRun({ teamName: `玩家${index}战队`, seed: `rank:${index}` });
    submitted.push(store.submit(draft(run)).entry);
  }
  store.close();
  store = createLeaderboardStore({ dbPath });
  try {
    const ranked = store.list({ limit: 100 });
    assert.equal(ranked.total, 14);
    const expected = [...submitted].sort((a, b) => a.placementRank - b.placementRank || b.wins - a.wins || a.losses - b.losses || b.teamRating - a.teamRating || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    assert.deepEqual(ranked.entries.map(entry => entry.id), expected.map(entry => entry.id));
    assert.deepEqual(ranked.entries.map(entry => entry.rank), Array.from({ length: 14 }, (_, i) => i + 1));
    const ownId = ranked.entries.at(-1).id;
    const limited = store.list({ limit: 3, entryId: ownId });
    assert.equal(limited.entries.length, 3);
    assert.equal(limited.ownEntry.rank, 14);
    assert.equal(limited.ownEntry.id, ownId);
    assert.throws(() => store.list({ limit: 1000 }), /条数/);
    assert.throws(() => store.list({ limit: 0 }), /条数/);
  } finally { store.close(); }
});

test('HTTP server serves the built site and a real JSON API, rejects cross-origin writes and hides storage files', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'worlds-http-'));
  mkdirSync(join(folder, 'dist'));
  writeFileSync(join(folder, 'dist', 'index.html'), '<!doctype html><title>Worlds</title>');
  writeFileSync(join(folder, 'private.sqlite'), 'not public');
  const store = memoryStore(t);
  const server = createAppServer({ store, distPath: join(folder, 'dist') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.equal(await home.text(), readFileSync(join(folder, 'dist', 'index.html'), 'utf8'));
  const health = await fetch(`${base}/api/health`);
  assert.equal((await health.json()).ok, true);
  const created = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamName: '网络玩家', seed: 'http-test' }) });
  assert.equal(created.status, 201);
  const run = await created.json();
  const published = await fetch(`${base}/api/leaderboard`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft(run)) });
  assert.equal(published.status, 201);
  const publishedBody = await published.json();
  const secondBrowser = await fetch(`${base}/api/leaderboard?entryId=${publishedBody.entry.id}`);
  const board = await secondBrowser.json();
  assert.equal(board.entries[0].teamName, '网络玩家');
  assert.equal(board.ownEntry.id, publishedBody.entry.id);
  const crossOrigin = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example' }, body: JSON.stringify({ teamName: '跨域请求' }) });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await fetch(`${base}/api/leaderboard?limit=999`)).status, 400);
  assert.equal((await fetch(`${base}/api/runs`, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
  const traversal = await fetch(`${base}/..%2Fprivate.sqlite`);
  assert.equal(traversal.status, 403);
  assert.equal((await fetch(`${base}/private.sqlite`)).status, 404);
});

test('large static text streams gzip when accepted, with correct raw bytes, HEAD metadata and negotiation', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'worlds-gzip-'));
  const source = 'const player = "世界赛选手";\n'.repeat(1000);
  writeFileSync(join(folder, 'large.js'), source);
  writeFileSync(join(folder, 'small.css'), 'body { color: white; }');
  writeFileSync(join(folder, 'binary.png'), Buffer.alloc(3000, 1));
  const store = memoryStore(t);
  const server = createAppServer({ store, distPath: folder });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); });
  const raw = (path, encoding, method = 'GET') => new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: server.address().port, path, method, headers: { 'accept-encoding': encoding } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
  const zipped = await raw('/large.js', 'br, gzip');
  assert.equal(zipped.status, 200);
  assert.equal(zipped.headers['content-encoding'], 'gzip');
  assert.equal(zipped.headers.vary, 'Accept-Encoding');
  assert.equal(zipped.headers['content-length'], undefined);
  assert.equal(gunzipSync(zipped.body).toString('utf8'), source);
  assert(zipped.body.length < Buffer.byteLength(source) / 4);
  const head = await raw('/large.js', 'gzip', 'HEAD');
  assert.equal(head.headers['content-encoding'], 'gzip');
  assert.equal(head.headers['content-length'], undefined);
  assert.equal(head.body.length, 0);
  const identity = await raw('/large.js', 'gzip;q=0, *;q=1');
  assert.equal(identity.headers['content-encoding'], undefined);
  assert.equal(Number(identity.headers['content-length']), Buffer.byteLength(source));
  assert.equal(identity.headers.vary, 'Accept-Encoding');
  assert.equal(identity.body.toString('utf8'), source);
  assert.equal((await raw('/small.css', 'gzip')).headers['content-encoding'], undefined);
  assert.equal((await raw('/binary.png', 'gzip')).headers['content-encoding'], undefined);
  assert.equal((await raw('/api/health', 'gzip')).headers['content-encoding'], undefined);
});
