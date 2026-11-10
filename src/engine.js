import { NINJAS, ROLES, STAT_KEYS, VILLAGES } from './data.js';
import { DRAFT_POOLS, ERAS, NINJA_VERSIONS } from './eras.js';

const ROLE_IDS = ['captain', 'scout', 'assault', 'support'];
const ROLE_NAMES = { captain: '队长', scout: '侦察', assault: '突破', support: '支援' };
const BOND_NAMES = {
  team7: '第七班', team10: '猪鹿蝶', hyuga: '日向一族', teamGuy: '凯班',
  sannin: '传说三忍', akatsuki: '晓', sandSiblings: '砂隐三姐弟',
  puppetMasters: '傀儡师', mistEscort: '水影护卫', taka: '鹰小队',
  abBrothers: 'AB兄弟', cloudEscort: '雷影护卫', teamSamui: '萨姆依小队', stoneEscort: '土影护卫',
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rounded = (value) => Math.round(value * 100) / 100;

/** Stable unsigned FNV-1a hash; safe to persist or pass between browser and Node. */
export function hashSeed(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32. Each invocation owns its state and returns values in [0, 1). */
export function seededRandom(seed) {
  let state = typeof seed === 'number' && Number.isFinite(seed)
    ? Math.trunc(seed) >>> 0
    : hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shanghaiDay(input = new Date()) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const parsed = new Date(`${input}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input) {
      throw new RangeError('日期必须是有效的 YYYY-MM-DD。');
    }
    return input;
  }
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError('日期无效。');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    globalThis.crypto.getRandomValues(values);
    return `${values[0].toString(16)}-${values[1].toString(16)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Four initial draws followed by two optional redraws, consumed in order. */
export function createGame({ mode = 'free', seed, date, rulesVersion = 3 } = {}) {
  if (!['free', 'daily'].includes(mode)) throw new RangeError('未知的挑战模式。');
  if (![2, 3].includes(rulesVersion)) throw new RangeError('未知的抽签规则版本。');
  const day = shanghaiDay(date);
  const resolvedSeed = mode === 'daily' ? `nindo-daily:${day}` : String(seed ?? randomSeed());
  const rng = seededRandom(`draws:${resolvedSeed}`);
  const villageIds = VILLAGES.map((village) => village.id);
  if (!villageIds.length) throw new Error('忍村数据为空。');
  let draws;
  let eras;
  if (rulesVersion === 2) {
    // Existing saves and shared challenges keep their original draw sequence.
    draws = Array.from({ length: 6 }, () => villageIds[Math.floor(rng() * villageIds.length)]);
    eras = draws.map((villageId, index) => {
      const available = DRAFT_POOLS.filter(pool => pool.villageId === villageId);
      if (!available.length) throw new Error('该忍村没有可用的时期档案。');
      const eraRandom = seededRandom(`eras:${resolvedSeed}:${index}:${villageId}`);
      return available[Math.floor(eraRandom() * available.length)].eraId;
    });
  } else {
    const storyEras = ERAS.filter(era => era.id !== 'legacy' &&
      DRAFT_POOLS.some(pool => pool.eraId === era.id));
    if (storyEras.length < 2) throw new Error('可用的剧情时期不足。');
    const eraRandom = seededRandom(`story-eras:${resolvedSeed}`);
    const villageRandom = seededRandom(`story-villages:${resolvedSeed}`);
    draws = [];
    eras = [];
    for (let index = 0; index < 6; index++) {
      // Keep story eras equally likely overall, without consecutive repeats.
      const availableEras = storyEras.filter(era => era.id !== eras.at(-1));
      const eraId = availableEras[Math.floor(eraRandom() * availableEras.length)].id;
      const availablePools = DRAFT_POOLS.filter(pool => pool.eraId === eraId);
      const pool = availablePools[Math.floor(villageRandom() * availablePools.length)];
      draws.push(pool.villageId);
      eras.push(eraId);
    }
  }
  return {
    rulesVersion,
    seed: resolvedSeed,
    mode,
    draws,
    eras,
    missionSeed: hashSeed(`missions:${resolvedSeed}`),
    day,
  };
}

function identity(ninja) {
  return ninja.baseCharacterId ?? ninja.baseId ?? ninja.id;
}

function validateNinja(ninja) {
  if (!ninja || typeof ninja !== 'object' || !ninja.id) throw new TypeError('忍者数据缺少身份。');
  if (STAT_KEYS.some((key) => !Number.isFinite(ninja.stats?.[key])
    || ninja.stats[key] < 0 || ninja.stats[key] > 100)) {
    throw new RangeError('忍者八维属性必须完整，且处于 0～100。');
  }
}

function validateTeam(team, requireComplete = false) {
  if (!team || typeof team !== 'object' || Array.isArray(team)) {
    throw new TypeError('小队必须按四个职责分配。');
  }
  const selected = new Set();
  for (const role of ROLE_IDS) {
    const ninja = team[role];
    if (ninja == null) {
      if (requireComplete) throw new Error('请先填满四个职责，组成完整小队。');
      continue;
    }
    validateNinja(ninja);
    const id = identity(ninja);
    if (selected.has(id)) throw new Error('同一名忍者不能重复加入小队。');
    selected.add(id);
  }
  return selected;
}

export function getCandidates(villageId, team = {}, eraId) {
  if (!VILLAGES.some((village) => village.id === villageId)) throw new RangeError('未知的忍村。');
  if (eraId !== undefined && !ERAS.some(era => era.id === eraId)) throw new RangeError('未知的剧情时期。');
  const selected = validateTeam(team);
  const source = eraId === undefined ? NINJAS : NINJA_VERSIONS.filter(ninja => ninja.eraId === eraId);
  return source.filter((ninja) => ninja.village === villageId && !selected.has(identity(ninja)));
}

/** Each village draw offers six distinct, unpicked ninjas; reloading replays that offer. */
export function drawCandidates(villageId, team = {}, seed = 'default', drawIndex = 0, eraId) {
  if (!Number.isInteger(drawIndex) || drawIndex < 0 || drawIndex > 5) throw new RangeError('候选抽取序号必须在 0～5 之间。');
  const pool = getCandidates(villageId, team, eraId);
  const rng = seededRandom(`candidates:${String(seed)}:${drawIndex}:${villageId}${eraId === undefined ? '' : `:${eraId}`}`);
  const count = Math.min(6, pool.length);
  for (let index = 0; index < count; index++) {
    const chosen = index + Math.floor(rng() * (pool.length - index));
    [pool[index], pool[chosen]] = [pool[chosen], pool[index]];
  }
  return pool.slice(0, count);
}

export function roleScore(ninja, roleId) {
  const role = ROLES.find((entry) => entry.id === roleId);
  if (!role || !ROLE_IDS.includes(roleId)) throw new RangeError('未知的小队职责。');
  validateNinja(ninja);
  const weightTotal = STAT_KEYS.reduce((total, key) => total + (role.weights[key] ?? 0), 0);
  if (weightTotal <= 0) throw new Error('职责权重无效。');
  const base = STAT_KEYS.reduce((total, key) => total
    + ninja.stats[key] * (role.weights[key] ?? 0), 0) / weightTotal;
  const traitWeights = {
    captain: { tactics: 4 }, scout: { sensor: 12, stealth: 4 },
    assault: { assault: 4, ranged: 1 }, support: { medical: 8, seal: 4, guard: 2 },
  };
  const bonus = Math.min(12, Object.entries(traitWeights[roleId]).reduce((sum, [tag, value]) =>
    sum + (ninja.tags?.includes(tag) ? value : 0), 0));
  return rounded(Math.min(100, base + bonus));
}

/** Partial teams are supported for draft previews; simulation requires all four. */
export function evaluateTeam(team) {
  validateTeam(team);
  const roles = Object.fromEntries(ROLE_IDS.map((role) => [role, team[role] ? roleScore(team[role], role) : 0]));
  const stat = (role, key) => team[role]?.stats[key] ?? 0;
  // A strong link needs both ends. Improving any attribute never reduces synergy.
  let synergy = Math.min(stat('captain', 'int'), stat('scout', 'spd')) / 100
    + Math.min(stat('assault', 'sta'), stat('support', 'seal')) / 100;
  const groups = new Map();
  for (const role of ROLE_IDS) {
    const ninja = team[role];
    if (!ninja?.bond) continue;
    if (!groups.has(ninja.bond)) groups.set(ninja.bond, []);
    groups.get(ninja.bond).push(ninja);
  }
  const bonds = [];
  for (const [name, members] of groups) {
    if (members.length < 2) continue;
    synergy += Math.min(2, (members.length - 1) * 0.75);
    bonds.push({ name: BOND_NAMES[name] ?? name, description: `${members.map((ninja) => ninja.name).join('、')}形成默契配合，协同略有提升。` });
  }
  synergy = rounded(Math.min(4, synergy));
  const ranked = [...ROLE_IDS].sort((a, b) => roles[b] - roles[a]);
  const strengths = ranked.filter((role) => roles[role] >= 76).map((role) =>
    `${ROLE_NAMES[role]}适配 ${Math.round(roles[role])}：${team[role].name}能发挥该职责的长处。`);
  const weaknesses = [...ranked].reverse().filter((role) => roles[role] < 65).map((role) =>
    team[role]
      ? `${ROLE_NAMES[role]}适配 ${Math.round(roles[role])}：相关任务容易受此处短板影响。`
      : `${ROLE_NAMES[role]}尚未就位。`);
  return { roles, synergy, bonds, strengths, weaknesses };
}

const TASK_TYPES = [
  { type: '潜入', role: 'scout', weights: { captain: 0.25, scout: 0.40, assault: 0.15, support: 0.20 } },
  { type: '追踪', role: 'captain', weights: { captain: 0.35, scout: 0.35, assault: 0.15, support: 0.15 } },
  { type: '强袭', role: 'assault', weights: { captain: 0.20, scout: 0.15, assault: 0.45, support: 0.20 } },
  { type: '护送', role: 'support', weights: { captain: 0.25, scout: 0.15, assault: 0.20, support: 0.40 } },
];
const TASK_NAMES = {
  潜入: ['暗夜越境', '敌营取证', '无声潜行', '禁区谍报', '影下密令'],
  追踪: ['失踪的密使', '荒原追缉', '叛忍行踪', '跨国围捕', '终局追猎'],
  强袭: ['山隘夺回', '断桥突击', '要塞突破', '破阵先遣', '孤城强攻'],
  护送: ['机密卷轴护送', '边境撤离', '商队危途', '伤员转移', '最后的归途'],
};
const TASK_AREAS = ['北境', '海岸', '荒漠'];
// Difficulty is spread across S-rank missions, rather than 20 identical coin flips.
const DIFFICULTIES = [42, 46, 50, 54, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 84, 87, 91, 95];

/** Mission types are independent equal-probability draws, fixed before the team is chosen. */
export function createMissionPlan(seed) {
  const seedText = String(seed ?? 'default');
  const occurrences = Object.fromEntries(TASK_TYPES.map(task => [task.type, 0]));
  return DIFFICULTIES.map((difficulty, index) => {
    const typeRandom = seededRandom(`mission-type:${seedText}:${index + 1}`);
    const task = TASK_TYPES[Math.floor(typeRandom() * TASK_TYPES.length)];
    const occurrence = occurrences[task.type]++;
    const names = TASK_NAMES[task.type];
    const baseName = names[occurrence % names.length];
    const cycle = Math.floor(occurrence / names.length);
    const name = cycle ? `${baseName} · ${TASK_AREAS[cycle - 1]}` : baseName;
    const rng = seededRandom(`mission:${seedText}:${index + 1}`);
    const luck = rounded(4 * (rng() + rng() - 1));
    return { id: `s-${String(index + 1).padStart(2, '0')}`, name, type: task.type,
      role: task.role, weights: { ...task.weights }, difficulty, luck };
  });
}

function resultTitle(wins) {
  if (wins === 20) return 'S级任务传奇';
  if (wins >= 18) return '影级精锐';
  if (wins >= 15) return '上忍王牌';
  if (wins >= 11) return '协作新锐';
  return '仍需磨合的小队';
}

export function simulateMissions(team, seed) {
  validateTeam(team, true);
  const analysis = evaluateTeam(team);
  const missions = createMissionPlan(seed).map(task => {
    const { id, name, difficulty, luck } = task;
    const geometric = Math.exp(ROLE_IDS.reduce((sum, role) => sum
      + task.weights[role] * Math.log(Math.max(0.05, analysis.roles[role] / 100)), 0));
    const penalty = 20 * Math.max(0, 0.55 - analysis.roles[task.role] / 100);
    const score = rounded(clamp(100 * geometric - penalty + analysis.synergy, 0, 100));
    const success = score + luck >= difficulty;
    const roleName = ROLE_NAMES[task.role];
    let reason;
    if (success) {
      reason = score - difficulty >= 4
        ? `${roleName}与全队配合稳健，以充足余量完成任务。`
        : `${roleName}顶住关键环节，全队在临界处把握住了机会。`;
    } else {
      reason = difficulty - score > 4
        ? `任务需要更强的${roleName}与队伍配合，当前准备未达到要求。`
        : `关键环节距离要求很近，${luck < 0 ? '现场波动使任务失利' : '仍欠缺一点执行余量'}。`;
    }
    return { id, name, type: task.type,
      role: task.role, difficulty, score, luck, success, reason };
  });
  const wins = missions.filter((mission) => mission.success).length;
  return { wins, losses: 20 - wins, missions, analysis, total: 20, title: resultTitle(wins) };
}
