import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { DEVICE_KEY, getDeviceId } from '../src/worlds/device.js';
import { createOnlineRun, submitOnlineRun } from '../src/worlds/leaderboard.js';

function browserEnvironment() {
  const values = new Map();
  return { crypto: webcrypto, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
}

test('browser identity persists across requests and reloads and follows shared storage across tabs', () => {
  const browser = browserEnvironment();
  const id = getDeviceId(browser);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(getDeviceId(browser), id);
  assert.equal(getDeviceId({ ...browser }), id);
  const otherTabId = webcrypto.randomUUID();
  browser.localStorage.setItem(DEVICE_KEY, otherTabId);
  assert.equal(getDeviceId(browser), otherTabId, 'an in-memory cache cannot override another tab');
  browser.localStorage.removeItem(DEVICE_KEY);
  assert.notEqual(getDeviceId(browser), otherTabId, 'cleared browser storage starts a new anonymous identity');
});

test('separate browsers get separate identifiers and malformed stored identifiers are replaced', () => {
  const a = browserEnvironment();
  const b = browserEnvironment();
  a.localStorage.setItem(DEVICE_KEY, 'a team name is not an identity');
  const id = getDeviceId(a);
  assert.notEqual(id, getDeviceId(b));
  assert.equal(a.localStorage.getItem(DEVICE_KEY), id);
  a.localStorage.setItem(DEVICE_KEY, id.toUpperCase());
  assert.equal(getDeviceId(a), id);
});

test('unavailable storage never masquerades as a stable device and crypto fallback remains UUID v4', () => {
  const blockedRead = { get localStorage() { throw Error('blocked'); } };
  const blockedWrite = { crypto: webcrypto, localStorage: { getItem: () => null, setItem() { throw Error('full'); } } };
  const noSave = { crypto: webcrypto, localStorage: { getItem: () => null, setItem() {} } };
  assert.equal(getDeviceId(blockedRead), undefined);
  assert.equal(getDeviceId(blockedWrite), undefined);
  assert.equal(getDeviceId(noSave), undefined);
  const fallback = browserEnvironment();
  fallback.crypto = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
  assert.match(getDeviceId(fallback), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('an active game keeps its original device attribution if another tab changes the browser identifier', async t => {
  const browser = browserEnvironment();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browser.localStorage });
  t.after(() => { if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ runId: 'active-run' }) };
  });
  const run = await createOnlineRun({ teamName: '第一队' });
  assert.equal(run.deviceId, requests[0].deviceId);
  browser.localStorage.setItem(DEVICE_KEY, webcrypto.randomUUID());
  await submitOnlineRun({ runId: run.runId, deviceId: run.deviceId, actions: [], team: {} });
  assert.equal(requests[1].deviceId, requests[0].deviceId);
  await createOnlineRun({ teamName: '下一队' });
  assert.notEqual(requests[2].deviceId, requests[0].deviceId);
});
