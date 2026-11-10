import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as engine from '../src/worlds/engine.js';

const SLOTS = ['top', 'jungle', 'mid', 'adc', 'support', 'bench'];
const MAX_SEED_LENGTH = 159;

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validTeamName(value) {
  if (typeof value !== 'string') throw new ApiError(400, '请先为战队命名。');
  const name = value.trim();
  if (!name || [...name].length > 16 || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
    throw new ApiError(400, '战队名称需要 1–16 个字符，不能包含控制字符。');
  }
  return name;
}

function checkedObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, message);
  return value;
}

function validateSubmission(game, payload) {
  const actions = payload.actions;
  if (!Array.isArray(actions) || actions.length !== 6) throw new ApiError(400, '需要完整的六轮签约记录。');
  const recruited = {};
  let previousDraw = -1;
  const canonicalActions = [];
  for (let round = 0; round < 6; round++) {
    const action = checkedObject(actions[round], '签约记录无效。');
    const { playerId, drawIndex } = action;
    if (typeof playerId !== 'string' || playerId.length > 120 || !Number.isInteger(drawIndex) || drawIndex <= previousDraw || drawIndex > round + 2 || (game.mode === 'daily' && drawIndex !== round)) {
      throw new ApiError(400, '抽取次数或签约记录无效。');
    }
    const candidates = engine.drawCandidates(engine.gameAtRound(game, round), recruited, drawIndex);
    if (!candidates.some(player => player.id === playerId)) throw new ApiError(400, '签约选手不在该轮六名候选中。');
    recruited[SLOTS[round]] = playerId;
    canonicalActions.push({ playerId, drawIndex });
    previousDraw = drawIndex;
  }
  const submittedTeam = checkedObject(payload.team, '需要完整出征阵容。');
  if (Object.keys(submittedTeam).length !== 6 || !SLOTS.every(slot => typeof submittedTeam[slot] === 'string')) throw new ApiError(400, '出征阵容需要五名首发和一名替补。');
  const signed = new Set(Object.values(recruited));
  if (new Set(Object.values(submittedTeam)).size !== 6 || !SLOTS.every(slot => signed.has(submittedTeam[slot]))) throw new ApiError(400, '出征名单必须与六轮签约选手一致。');
  return { actions: canonicalActions, team: Object.fromEntries(SLOTS.map(slot => [slot, submittedTeam[slot]])) };
}

function entryFrom(row) {
  if (!row) return null;
  return {
    id: row.id, rank: row.position, teamName: row.team_name, placement: row.placement,
    placementRank: row.placement_rank, wins: row.wins, losses: row.losses,
    seriesWins: row.series_wins, seriesLosses: row.series_losses,
    teamRating: row.team_rating, createdAt: row.created_at,
    regionId: row.region_id, seasonId: '2026', tournamentYear: 2026,
  };
}

const RANKED = `SELECT id, team_name, placement, placement_rank, wins, losses,
  series_wins, series_losses, team_rating, created_at, region_id,
  ROW_NUMBER() OVER (ORDER BY placement_rank ASC, wins DESC, losses ASC,
    team_rating DESC, created_at ASC, id ASC) AS position FROM entries`;

/** One durable database is shared by every browser visiting this server. */
export function createLeaderboardStore({ dbPath = process.env.DB_PATH || './storage/worlds.sqlite', now = () => new Date(), makeId = randomUUID } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, team_name TEXT NOT NULL, game_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY, run_id TEXT UNIQUE NOT NULL REFERENCES runs(id),
    team_name TEXT NOT NULL, placement TEXT NOT NULL, placement_rank INTEGER NOT NULL,
    wins INTEGER NOT NULL, losses INTEGER NOT NULL,
    series_wins INTEGER NOT NULL, series_losses INTEGER NOT NULL,
    team_rating REAL NOT NULL, region_id TEXT NOT NULL, created_at TEXT NOT NULL,
    result_json TEXT NOT NULL, team_json TEXT NOT NULL, actions_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS leaderboard_order ON entries (
    placement_rank, wins DESC, losses, team_rating DESC, created_at
  );`);

  const rankedEntry = id => entryFrom(db.prepare(`SELECT * FROM (${RANKED}) WHERE id = ?`).get(id));
  return {
    createRun(input) {
      const payload = checkedObject(input, '请求格式无效。');
      const teamName = validTeamName(payload.teamName);
      const mode = payload.mode ?? 'free';
      if (!['free', 'daily'].includes(mode)) throw new ApiError(400, '未知挑战模式。');
      if (payload.seed !== undefined && (typeof payload.seed !== 'string' || !payload.seed || payload.seed.length > MAX_SEED_LENGTH || /[\u0000-\u001f\u007f]/u.test(payload.seed))) throw new ApiError(400, '挑战种子无效。');
      let date = now();
      if (mode === 'daily' && payload.seed !== undefined) {
        const match = /^worlds-daily:(\d{4}-\d{2}-\d{2})$/.exec(payload.seed);
        if (!match) throw new ApiError(400, '每日同签链接无效。');
        date = match[1];
      }
      let game;
      try { game = engine.createGame({ mode, seed: payload.seed ?? makeId(), date, rulesVersion: 2 }); }
      catch { throw new ApiError(400, '挑战种子或日期无效。'); }
      const runId = makeId();
      db.prepare('INSERT INTO runs(id,team_name,game_json,created_at) VALUES(?,?,?,?)').run(runId, teamName, JSON.stringify(game), now().toISOString());
      return { runId, teamName, game };
    },
    submit(input) {
      const payload = checkedObject(input, '请求格式无效。');
      if (typeof payload.runId !== 'string' || payload.runId.length > 100) throw new ApiError(400, '本局标识无效。');
      const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(payload.runId);
      if (!run) throw new ApiError(404, '本局未在服务器登记，请开始新一局。');
      const game = JSON.parse(run.game_json);
      const { actions, team } = validateSubmission(game, payload);
      const teamJson = JSON.stringify(team);
      const actionsJson = JSON.stringify(actions);
      const existing = db.prepare('SELECT * FROM entries WHERE run_id = ?').get(run.id);
      if (existing) {
        if (existing.team_json !== teamJson || existing.actions_json !== actionsJson) throw new ApiError(409, '本局已经结算，不能修改出征阵容。');
        return { entry: rankedEntry(existing.id), result: JSON.parse(existing.result_json), duplicate: true };
      }
      if (typeof engine.simulateWorlds2026 !== 'function') throw new ApiError(503, '赛事结算暂不可用，请稍后重试。');
      const result = engine.simulateWorlds2026(engine.gameAtRound(game, 5), team);
      const id = makeId();
      const createdAt = now().toISOString();
      db.prepare(`INSERT INTO entries(id,run_id,team_name,placement,placement_rank,
        wins,losses,series_wins,series_losses,team_rating,region_id,created_at,
        result_json,team_json,actions_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, run.id, run.team_name, result.placement, result.rank,
        result.record.wins, result.record.losses, result.seriesRecord.wins,
        result.seriesRecord.losses, result.rating, result.regionId, createdAt,
        JSON.stringify(result), teamJson, actionsJson,
      );
      return { entry: rankedEntry(id), result, duplicate: false };
    },
    list({ limit = 10, entryId } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, '排行榜条数需要为 1–100。');
      if (entryId !== undefined && (typeof entryId !== 'string' || entryId.length > 100)) throw new ApiError(400, '排行榜标识无效。');
      const entries = db.prepare(`SELECT * FROM (${RANKED}) ORDER BY position LIMIT ?`).all(limit).map(entryFrom);
      const total = db.prepare('SELECT COUNT(*) AS count FROM entries').get().count;
      return { entries, total, ownEntry: entryId ? rankedEntry(entryId) : null, updatedAt: now().toISOString(), tournamentYear: 2026 };
    },
    close() { db.close(); },
  };
}
