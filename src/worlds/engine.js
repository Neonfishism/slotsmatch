import { PLAYERS, TEAMS, SEASONS, ROLES, STAT_KEYS } from './data.js';

const ROLE_IDS = ['top', 'jungle', 'mid', 'adc', 'support'];
const SLOTS = [...ROLE_IDS, 'bench'];
const ROLE_NAMES = Object.fromEntries(ROLES.map(role => [role.id, role.name]));
const playerById = new Map(PLAYERS.map(player => [player.id, player]));
const seasonById = new Map(SEASONS.map(season => [season.id, season]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 10) / 10;
const identity = player => String(player.identity || player.name || player.id).toLowerCase();
const resolve = player => typeof player === 'string' ? playerById.get(player) : player;
const weights = {
  top:     [0.27, 0.27, 0.19, 0.12, 0.04, 0.11],
  jungle:  [0.15, 0.10, 0.18, 0.28, 0.18, 0.11],
  mid:     [0.25, 0.25, 0.23, 0.14, 0.03, 0.10],
  adc:     [0.26, 0.22, 0.32, 0.07, 0.02, 0.11],
  support: [0.11, 0.05, 0.20, 0.22, 0.31, 0.11],
};
// Related positions retain some transferable skills, but a star in the wrong
// position should never replace the need to draft a balanced five-player team.
const transfer = {
  top:     { top: 1, jungle: 0.78, mid: 0.89, adc: 0.77, support: 0.72 },
  jungle:  { top: 0.77, jungle: 1, mid: 0.78, adc: 0.70, support: 0.85 },
  mid:     { top: 0.89, jungle: 0.81, mid: 1, adc: 0.85, support: 0.79 },
  adc:     { top: 0.75, jungle: 0.69, mid: 0.83, adc: 1, support: 0.77 },
  support: { top: 0.70, jungle: 0.83, mid: 0.74, adc: 0.75, support: 1 },
};

export function hashSeed(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function shanghaiDay(input = new Date()) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const date = new Date(`${input}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) throw new RangeError('日期无效。');
    return input;
  }
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError('日期无效。');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function freshSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    globalThis.crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function mainEventTeams(seasonId) {
  return TEAMS.filter(team => team.seasonId === seasonId && team.mainEvent === true);
}

/** Six selections need eleven distinct identities to keep six choices in round 6. */
export const AVAILABLE_POOLS = SEASONS.flatMap(season => season.regions.map(regionId => ({
  seasonId: season.id,
  regionId,
  playerCount: new Set(PLAYERS.filter(player => player.seasonId === season.id && player.region === regionId).map(identity)).size,
})).filter(pool => pool.playerCount >= 11 && mainEventTeams(season.id).some(team => team.region === pool.regionId)));

/** Preserve the original first draw; every later round gets its own fixed draw. */
function poolAtRound(seed, roundIndex) {
  const random = seededRandom(roundIndex === 0 ? `worlds-draw:${seed}` : `worlds-draw:${seed}:round:${roundIndex}`);
  const seasons = SEASONS.filter(season => AVAILABLE_POOLS.some(pool => pool.seasonId === season.id));
  if (!seasons.length) throw new Error('没有人数充足的参赛选手池。');
  const season = seasons[Math.floor(random() * seasons.length)];
  const pools = AVAILABLE_POOLS.filter(pool => pool.seasonId === season.id);
  return pools[Math.floor(random() * pools.length)];
}

function validateRound(roundIndex) {
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex > 5) throw new RangeError('选人轮次必须为0到5。');
}

/** Each round selects a season uniformly, then an eligible region uniformly. */
export function createGame({ seed, mode = 'free', date, rulesVersion = 2, roundIndex = 0 } = {}) {
  if (!['free', 'daily'].includes(mode)) throw new RangeError('未知挑战模式。');
  if (![1, 2].includes(rulesVersion)) throw new RangeError('未知世界赛规则版本。');
  validateRound(roundIndex);
  const day = shanghaiDay(date);
  const resolvedSeed = mode === 'daily' ? `worlds-daily:${day}` : String(seed ?? freshSeed());
  if (!resolvedSeed || resolvedSeed.length > 160) throw new RangeError('挑战种子长度无效。');
  const pool = poolAtRound(resolvedSeed, rulesVersion === 1 ? 0 : roundIndex);
  return { rulesVersion, seed: resolvedSeed, mode, day, seasonId: pool.seasonId, regionId: pool.regionId, tournamentSeed: hashSeed(`worlds-event:${resolvedSeed}`), ...(rulesVersion === 2 && { roundIndex }) };
}

/** Advance the draft without changing the seed, recruited players or event RNG. */
export function gameAtRound(game, roundIndex) {
  validateGame(game);
  validateRound(roundIndex);
  if (game.rulesVersion === 1) return { ...game, roundIndex };
  const pool = poolAtRound(game.seed, roundIndex);
  return { ...game, seasonId: pool.seasonId, regionId: pool.regionId, roundIndex };
}

function validateGame(game) {
  if (!game || !seasonById.has(game.seasonId) || !AVAILABLE_POOLS.some(pool => pool.seasonId === game.seasonId && pool.regionId === game.regionId)) {
    throw new RangeError('该赛季与赛区没有可用选手池。');
  }
  if (typeof game.seed !== 'string' || !game.seed || game.seed.length > 160 || !Number.isFinite(game.tournamentSeed)) throw new RangeError('挑战种子无效。');
  if (![1, 2].includes(game.rulesVersion)) throw new RangeError('未知世界赛规则版本。');
}

/** A position swap cannot change the candidate draw: only the sorted identities matter. */
export function drawCandidates(game, team = {}, drawIndex = 0) {
  validateGame(game);
  if (!Number.isInteger(drawIndex) || drawIndex < 0 || drawIndex > 7) throw new RangeError('抽签序号必须为0到7。');
  const picked = new Set(Object.values(team).map(resolve).filter(Boolean).map(identity));
  const eligible = PLAYERS.filter(player => player.seasonId === game.seasonId && player.region === game.regionId && !picked.has(identity(player)));
  const unique = [...new Map(eligible.map(player => [identity(player), player])).values()];
  if (unique.length < 6) throw new RangeError('剩余选手不足六人。');
  const random = seededRandom(`worlds-offer:${game.seed}:${game.seasonId}:${game.regionId}:${drawIndex}:${[...picked].sort().join('|')}`);
  return shuffled(unique, random).slice(0, 6);
}

function validatePlayer(player) {
  if (!player || !ROLE_IDS.includes(player.role) || !STAT_KEYS.every(key => Number.isFinite(player.stats?.[key]) && player.stats[key] >= 0 && player.stats[key] <= 100)) {
    throw new TypeError('选手档案必须包含有效原生位置和六维能力。');
  }
}

export function roleScore(rawPlayer, roleId) {
  const player = resolve(rawPlayer);
  if (!SLOTS.includes(roleId)) throw new RangeError('未知战队位置。');
  if (!player) return 0;
  validatePlayer(player);
  const target = roleId === 'bench' ? player.role : roleId;
  const base = STAT_KEYS.reduce((sum, key, index) => sum + weights[target][index] * player.stats[key], 0);
  return round(clamp(base * transfer[player.role][target], 0, 100));
}

/** Partial teams are safe to render; only simulateWorlds requires a complete six. */
export function evaluateTeam(rawTeam = {}) {
  const team = Object.fromEntries(SLOTS.map(slot => [slot, resolve(rawTeam[slot]) || null]));
  const roleScores = Object.fromEntries(ROLE_IDS.map(role => [role, roleScore(team[role], role)]));
  const starters = ROLE_IDS.map(role => team[role]).filter(Boolean);
  const filled = starters.length;
  const sourceTeams = new Map();
  for (const player of starters) sourceTeams.set(player.teamId, (sourceTeams.get(player.teamId) || 0) + 1);
  const familiarity = [...sourceTeams.values()].reduce((sum, count) => sum + Math.max(0, count - 1) * 0.6, 0);
  const mapConnection = team.jungle && team.support ? Math.min(team.jungle.stats.macro, team.support.stats.vision) / 100 : 0;
  const synergy = round(Math.min(3.5, familiarity + mapConnection));
  const bench = team.bench;
  if (bench) validatePlayer(bench);
  const matchingStarter = bench && team[bench.role];
  const depth = matchingStarter ? Math.max(0, roleScore(bench, bench.role) - roleScores[bench.role]) * 0.04 : 0;
  const benchBonus = bench ? round(Math.min(2.5, roleScore(bench, 'bench') / 100 * 1.25 + bench.stats.mentality / 100 * 0.5 + depth)) : 0;
  const base = filled ? Math.exp(ROLE_IDS.reduce((sum, role) => sum + Math.log(Math.max(1, roleScores[role])), 0) / 5) : 0;
  // Reserve headroom for coordination and the sixth player, so a collection of
  // high individual ratings does not immediately hit 100 and erase their effect.
  const rating = round(clamp(base * 0.94 + synergy + benchBonus, 0, 100));
  const best = [...ROLE_IDS].filter(role => team[role]).sort((a, b) => roleScores[b] - roleScores[a]);
  const offRoles = ROLE_IDS.filter(role => team[role] && team[role].role !== role);
  const strengths = best.slice(0, 2).map(role => `${ROLE_NAMES[role]} ${team[role].name} · 适配 ${roleScores[role]}`);
  if (bench) strengths.push(`替补深度 +${benchBonus} · ${bench.name}提供训练与轮换支持`);
  const weaknesses = offRoles.map(role => `${team[role].name}跨位${ROLE_NAMES[role]}，适配下降`);
  if (filled < 5) weaknesses.push(`还缺 ${5 - filled} 个首发位置`);
  else if (!offRoles.length) weaknesses.push(`${ROLE_NAMES[best.at(-1)]}是当前相对薄弱的位置`);
  return { rating, synergy, roleScores, roles: roleScores, benchBonus, strengths, weaknesses, filled, count: starters.length + Number(Boolean(bench)), offRoleCount: offRoles.length };
}

function completeTeam(game, rawTeam) {
  if (SLOTS.some(slot => !rawTeam?.[slot])) throw new RangeError('需要完整五人首发和一名替补才能出征。');
  const team = {};
  for (const slot of SLOTS) {
    const raw = rawTeam[slot];
    const player = playerById.get(typeof raw === 'string' ? raw : raw.id);
    if (!player) throw new RangeError('选手不在该届参赛名单中。');
    validatePlayer(player);
    if (game.rulesVersion === 1 && (player.seasonId !== game.seasonId || player.region !== game.regionId)) throw new RangeError('阵容必须来自本局赛季和赛区。');
    team[slot] = player;
  }
  if (new Set(Object.values(team).map(identity)).size !== 6) throw new RangeError('同一选手不能重复入队。');
  return team;
}

function makeContestants(game, evaluation, event = {}) {
  const field = mainEventTeams(event.opponentSeasonId || game.seasonId);
  if (field.length !== 16) throw new RangeError('该届正赛必须有十六支战队。');
  const regionalTeams = field.filter(team => team.region === game.regionId);
  // Historic draft regions do not all exist in the fixed exhibition field.
  // They still receive a main-event seat, without relabelling a real team.
  const replacements = regionalTeams.length || !event.allowOpenSlot ? regionalTeams : field;
  const random = seededRandom(`worlds-slot:${game.tournamentSeed}`);
  const replacementTeam = replacements[Math.floor(random() * replacements.length)];
  if (!replacementTeam) throw new RangeError('该赛区没有可替代的正赛席位。');
  const draft = { id: '__draft__', tag: 'YOUR TEAM', name: '你的战队', region: game.regionId, rating: evaluation.rating, isUser: true };
  const contestants = field.map(team => team.id === replacementTeam.id ? draft : { ...team, isUser: false });
  return { contestants, replacementTeam, draft };
}

function series(a, b, bestOf, context) {
  const { seed, stage, id, matches, evaluation, recordBefore, opponentRecordBefore } = context;
  const random = seededRandom(`${seed}:${id}:${[a.id, b.id].sort().join(':')}`);
  const probability = clamp(1 / (1 + Math.exp((b.rating - a.rating) / 7.6)), 0.025, 0.975);
  const needed = Math.ceil(bestOf / 2);
  let aWins = 0;
  let bWins = 0;
  while (aWins < needed && bWins < needed) {
    if (random() < probability) aWins++;
    else bWins++;
  }
  const winner = aWins > bWins ? a : b;
  const loser = winner === a ? b : a;
  if (a.isUser || b.isUser) {
    const isA = a.isUser;
    const wins = isA ? aWins : bWins;
    const losses = isA ? bWins : aWins;
    const opponent = isA ? b : a;
    const strongest = ROLE_IDS.reduce((best, role) => evaluation.roleScores[role] > evaluation.roleScores[best] ? role : best, ROLE_IDS[0]);
    const weakest = ROLE_IDS.reduce((best, role) => evaluation.roleScores[role] < evaluation.roleScores[best] ? role : best, ROLE_IDS[0]);
    const won = winner.isUser;
    const reason = won
      ? `${ROLE_NAMES[strongest]}发挥成为突破口，${evaluation.benchBonus ? `替补训练与轮换加成 +${evaluation.benchBonus}，` : ''}战队把握住关键机会。`
      : `${ROLE_NAMES[weakest]}的对位与整体运营承压，对手在关键团战中取得优势。`;
    matches.push({
      id, stage, opponent: opponent.tag, opponentId: opponent.id, opponentRegion: opponent.region,
      opponentRating: round(opponent.rating), format: `BO${bestOf}`, wins, losses, won: Boolean(won), score: `${wins} : ${losses}`,
      reason, winProbability: round((isA ? probability : 1 - probability) * 100),
      ...(recordBefore && { recordBefore: { ...(isA ? recordBefore : opponentRecordBefore) }, opponentRecordBefore: { ...(isA ? opponentRecordBefore : recordBefore) } }),
    });
  }
  return { winner, loser, aWins, bWins };
}

function groupDraw(contestants, random) {
  const counts = new Map();
  contestants.forEach(team => counts.set(team.region, (counts.get(team.region) || 0) + 1));
  const ordered = shuffled(contestants, random).sort((a, b) => counts.get(b.region) - counts.get(a.region));
  const groups = Array.from({ length: 4 }, (_, index) => ({ name: String.fromCharCode(65 + index), teams: [] }));
  function assign(index) {
    if (index === ordered.length) return true;
    const team = ordered[index];
    for (const group of shuffled(groups, random)) {
      if (group.teams.length === 4 || group.teams.some(other => other.region === team.region)) continue;
      group.teams.push(team);
      if (assign(index + 1)) return true;
      group.teams.pop();
    }
    return false;
  }
  if (!assign(0)) throw new Error('该届战队无法组成同赛区回避的小组。');
  return groups;
}

function playGroups(contestants, context) {
  const random = seededRandom(`worlds-groups:${context.seed}`);
  const groups = groupDraw(contestants, random);
  const qualified = [];
  let userGroup;
  let userRank;
  const groupTables = [];
  for (const group of groups) {
    const records = new Map(group.teams.map(team => [team.id, { wins: 0, losses: 0, headToHead: new Map(), tieWins: 0, tieOrder: random() }]));
    const play = (a, b, id, stage, tiebreak = false) => {
      const match = series(a, b, 1, { ...context, id, stage });
      const winning = records.get(match.winner.id);
      const losing = records.get(match.loser.id);
      if (tiebreak) winning.tieWins++;
      else {
        winning.wins++;
        losing.losses++;
        winning.headToHead.set(match.loser.id, (winning.headToHead.get(match.loser.id) || 0) + 1);
      }
    };
    for (let cycle = 0; cycle < 2; cycle++) {
      for (let first = 0; first < 4; first++) {
        for (let second = first + 1; second < 4; second++) {
          play(group.teams[first], group.teams[second], `groups-${group.name}-${cycle}-${first}-${second}`, `小组赛 · ${group.name}组 · 第${cycle + 1}循环`);
        }
      }
    }
    const tiedGroups = [...new Set([...records.values()].map(record => record.wins))].map(wins => group.teams.filter(team => records.get(team.id).wins === wins));
    for (const tied of tiedGroups) {
      if (tied.length < 2) continue;
      if (tied.length === 2) {
        const [a, b] = tied;
        const headA = records.get(a.id).headToHead.get(b.id) || 0;
        const headB = records.get(b.id).headToHead.get(a.id) || 0;
        if (headA !== headB) {
          records.get(headA > headB ? a.id : b.id).tieWins++;
          continue;
        }
      }
      // Historical match-duration seeding is unavailable in a fantasy roster.
      // A seeded BO1 mini round robin decides ties; remaining circular ties use
      // the fixed tournament draw, rather than silently changing on refresh.
      for (let first = 0; first < tied.length; first++) for (let second = first + 1; second < tied.length; second++) {
        play(tied[first], tied[second], `tiebreak-${group.name}-${first}-${second}`, `小组加赛 · ${group.name}组`, true);
      }
    }
    const sorted = [...group.teams].sort((a, b) => records.get(b.id).wins - records.get(a.id).wins || records.get(b.id).tieWins - records.get(a.id).tieWins || records.get(b.id).tieOrder - records.get(a.id).tieOrder);
    sorted.slice(0, 2).forEach((team, index) => qualified.push({ ...team, group: group.name, groupRank: index + 1 }));
    const table = sorted.map((team, index) => ({ id: team.id, tag: team.tag, region: team.region, wins: records.get(team.id).wins, losses: records.get(team.id).losses, rank: index + 1, isUser: team.isUser }));
    groupTables.push({ name: group.name, teams: table });
    if (group.teams.some(team => team.isUser)) {
      userGroup = group.name;
      userRank = sorted.findIndex(team => team.isUser) + 1;
    }
  }
  return { qualified, userGroup, userRank, groupTables };
}

function swissPairing(bucket, previous, random, firstRound, noRematches) {
  const ordered = shuffled(bucket, random);
  function pair(remaining) {
    if (!remaining.length) return [];
    const [a, ...others] = remaining;
    for (const b of shuffled(others, random)) {
      if ((noRematches && previous.has([a.id, b.id].sort().join('|'))) || (firstRound && a.region === b.region)) continue;
      const next = pair(others.filter(team => team.id !== b.id));
      if (next) return [[a, b], ...next];
    }
    return null;
  }
  return pair(ordered);
}

function playSwiss(contestants, context) {
  const random = seededRandom(`worlds-swiss:${context.seed}`);
  const records = new Map(contestants.map(team => [team.id, { wins: 0, losses: 0 }]));
  const previous = new Set();
  const rounds = [];
  const qualified = [];
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    const active = contestants.filter(team => records.get(team.id).wins < 3 && records.get(team.id).losses < 3);
    const buckets = new Map();
    active.forEach(team => {
      const record = records.get(team.id);
      const key = `${record.wins}-${record.losses}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(team);
    });
    const pairs = [];
    for (const bucket of buckets.values()) {
      const matching = swissPairing(bucket, previous, random, roundIndex === 0, context.noRematches);
      if (!matching) return null;
      pairs.push(...matching);
    }
    const roundResults = [];
    for (const [a, b] of pairs) {
      const aRecord = { ...records.get(a.id) };
      const bRecord = { ...records.get(b.id) };
      const bestOf = aRecord.wins === 2 || aRecord.losses === 2 ? 3 : 1;
      const match = series(a, b, bestOf, { ...context, id: `swiss-${roundIndex + 1}-${[a.id, b.id].sort().join('-')}`, stage: `瑞士轮 · 第${roundIndex + 1}轮`, recordBefore: aRecord, opponentRecordBefore: bRecord });
      records.get(match.winner.id).wins++;
      records.get(match.loser.id).losses++;
      previous.add([a.id, b.id].sort().join('|'));
      if (records.get(match.winner.id).wins === 3) qualified.push({ ...match.winner, swissWins: 3, swissLosses: records.get(match.winner.id).losses });
      roundResults.push({ a: a.tag, b: b.tag, score: `${match.aWins}:${match.bWins}`, winner: match.winner.tag, recordBefore: aRecord, bestOf });
    }
    rounds.push({ round: roundIndex + 1, matches: roundResults });
  }
  if (qualified.length !== 8) throw new Error('瑞士轮必须产生八支晋级战队。');
  const userRecord = records.get('__draft__');
  return { qualified, userRecord, swissRounds: rounds };
}

function knockoutDraw(qualified, format, random) {
  if (format === 'groups') {
    const winners = shuffled(qualified.filter(team => team.groupRank === 1), random);
    const runners = shuffled(qualified.filter(team => team.groupRank === 2), random);
    function match(index, available) {
      if (index === winners.length) return [];
      for (const runner of available) {
        if (runner.group === winners[index].group) continue;
        // The winner and runner-up of a group may meet again only in the final.
        const groupWinnerIndex = winners.findIndex(team => team.group === runner.group);
        if (Math.floor(groupWinnerIndex / 2) === Math.floor(index / 2)) continue;
        const next = match(index + 1, available.filter(team => team.id !== runner.id));
        if (next) return [[winners[index], runner], ...next];
      }
      return null;
    }
    const result = match(0, runners);
    if (!result) throw new Error('八强抽签失败。');
    return result;
  }
  const unbeaten = shuffled(qualified.filter(team => team.swissLosses === 0), random);
  const twoLoss = shuffled(qualified.filter(team => team.swissLosses === 2), random);
  const drawn = new Set();
  const unbeatenPairs = unbeaten.map(team => {
    const opponent = twoLoss.shift();
    drawn.add(team.id); drawn.add(opponent.id);
    return [team, opponent];
  });
  const remaining = shuffled(qualified.filter(team => !drawn.has(team.id)), random);
  const others = [];
  for (let index = 0; index < remaining.length; index += 2) others.push([remaining[index], remaining[index + 1]]);
  // Place one 3-0 team in each half of the bracket. They can meet only in the final.
  const halves = [shuffled([unbeatenPairs[0], others[0]], random), shuffled([unbeatenPairs[1], others[1]], random)];
  return shuffled(halves, random).flat();
}

function simulateEvent(game, rawTeam, event = {}) {
  validateGame(game);
  const team = completeTeam(game, rawTeam);
  const evaluation = evaluateTeam(team);
  const season = event.season || seasonById.get(game.seasonId);
  const { contestants, replacementTeam } = makeContestants(game, evaluation, event);
  let matches = [];
  let qualification;
  let context;
  if (season.format === 'groups') {
    context = { seed: game.tournamentSeed, matches, evaluation };
    qualification = playGroups(contestants, context);
  } else {
    // On the rare occasion an earlier random draw leaves no legal no-rematch
    // matching, restart the event with the next fixed salt. Results remain
    // deterministic and every recorded Swiss opponent has the same record.
    for (let attempt = 0; attempt < 80; attempt++) {
      matches = [];
      context = { seed: `${game.tournamentSeed}:draw-${attempt}`, matches, evaluation, noRematches: season.year >= 2024 };
      qualification = playSwiss(contestants, context);
      if (qualification) break;
    }
    if (!qualification) throw new Error('未能生成合法的瑞士轮对阵。');
  }
  const qualified = qualification.qualified.some(contestant => contestant.isUser);
  let placement;
  let rank;
  let stage;
  if (!qualified) {
    if (season.format === 'groups') {
      rank = qualification.userRank === 3 ? 9 : 13;
      placement = qualification.userRank === 3 ? '第9–12名' : '第13–16名';
      stage = '止步小组赛';
    } else {
      const wins = qualification.userRecord.wins;
      rank = wins === 2 ? 9 : wins === 1 ? 12 : 15;
      placement = wins === 2 ? '第9–11名' : wins === 1 ? '第12–14名' : '第15–16名';
      stage = `瑞士轮 ${wins}胜3负`;
    }
  }
  const knockout = [];
  let pairs = knockoutDraw(qualification.qualified, season.format, seededRandom(`worlds-knockout:${context.seed}`));
  for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
    const roundName = ['四分之一决赛', '半决赛', '总决赛'][roundIndex];
    const winners = [];
    for (let index = 0; index < pairs.length; index++) {
      const [a, b] = pairs[index];
      const result = series(a, b, 5, { ...context, id: `knockout-${roundIndex}-${index}`, stage: roundName });
      winners.push(result.winner);
      knockout.push({ stage: roundName, a: a.tag, b: b.tag, score: `${result.aWins}:${result.bWins}`, winner: result.winner.tag });
      if (result.loser.isUser) {
        placement = ['八强', '四强', '亚军'][roundIndex];
        rank = [5, 3, 2][roundIndex];
        stage = `止步${roundName}`;
      }
      if (roundIndex === 2 && result.winner.isUser) { placement = '冠军'; rank = 1; stage = '捧起召唤师杯'; }
    }
    pairs = [];
    for (let index = 0; index + 1 < winners.length; index += 2) pairs.push([winners[index], winners[index + 1]]);
  }
  const record = matches.reduce((total, match) => ({ wins: total.wins + match.wins, losses: total.losses + match.losses }), { wins: 0, losses: 0 });
  const seriesRecord = { wins: matches.filter(match => match.won).length, losses: matches.filter(match => !match.won).length };
  const deciding = matches.at(-1);
  return {
    placement, rank, stage, record, seriesRecord, matches, rating: evaluation.rating, evaluation,
    seasonId: season.id, regionId: game.regionId, format: season.format,
    replacementTeam: { id: replacementTeam.id, tag: replacementTeam.tag, name: replacementTeam.name, region: replacementTeam.region },
    fieldSize: 16, qualified, ...(qualification.userGroup && { group: qualification.userGroup }),
    ...(qualification.userRecord && { swissRecord: qualification.userRecord }),
    ...(qualification.groupTables && { groups: qualification.groupTables }),
    ...(qualification.swissRounds && { swissRounds: qualification.swissRounds }),
    knockout, summary: rank === 1 ? `你的${game.regionId}战队一路闯关，夺得${season.label}世界冠军。` : `你的${game.regionId}战队最终获得${placement}，${deciding?.opponent || '对手'}成为本届旅程的最后一战。`,
    simulationNote: event.simulationNote || '历史名单与赛制背景下的虚构战队模拟；替代同赛区一个正赛席位，历史冠军不会预设获胜。',
  };
}

/** Full historical 16-team main event. Retained for replaying earlier saves. */
export function simulateWorlds(game, rawTeam) {
  return simulateEvent(game, rawTeam);
}

// Riot's 2026 handbook specifies a 16-team Swiss main event followed by eight
// teams in a BO5 knockout bracket. This fantasy game starts in that main event;
// it does not simulate the four-team play-in or invent 2026 player ratings.
// https://lolesports.com/en-GB/news/worlds-2026-primer
// https://lolesports.com/en-GB/season/115547545029543948/handbook/115548016979679448
export const TOURNAMENT_2026 = Object.freeze({
  id: '2026', year: 2026, label: 'S16', name: '2026 全球总决赛', format: 'swiss',
});

/** Every newly completed draft competes in the same 2026 fantasy main event. */
export function simulateWorlds2026(game, rawTeam) {
  const result = simulateEvent(game, rawTeam, {
    season: TOURNAMENT_2026,
    opponentSeasonId: '2024',
    allowOpenSlot: true,
    simulationNote: '2026（S16）正赛规则下的虚构战队模拟；对手采用 S14 历史阵容与数值，不代表真实 2026 参赛阵容或赛果。',
  });
  return {
    ...result,
    tournamentYear: TOURNAMENT_2026.year,
    tournamentLabel: TOURNAMENT_2026.name,
    tournamentSeasonLabel: TOURNAMENT_2026.label,
    opponentSeasonId: '2024',
    draftSeasonId: game.seasonId,
  };
}
