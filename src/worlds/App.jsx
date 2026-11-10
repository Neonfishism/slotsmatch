import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, Crosshair, Dices, Globe2, History, Info, Layers3, LoaderCircle, RefreshCw, Shield, Shuffle, Sparkles, Swords, Target, Trophy, Users, X, Zap } from 'lucide-react';
import { PLAYERS, REGIONS, ROLES, SEASONS, SOURCES, STAT_KEYS, STAT_LABELS, TEAMS } from './data.js';
import { AVAILABLE_POOLS, createGame, drawCandidates, evaluateTeam, gameAtRound, roleScore, simulateWorlds2026 } from './engine.js';
import Leaderboard from './Leaderboard.jsx';
import { createOnlineRun, submitOnlineRun } from './leaderboard.js';
import './worlds.css';

const SAVE_KEY = 'worlds-draft-save-v1';
const HISTORY_KEY = 'worlds-draft-history-v1';
const SLOTS = [...ROLES, { id: 'bench', name: '替补', short: 'SUB' }];
const roleIcons = { top: Shield, jungle: Swords, mid: Zap, adc: Crosshair, support: Target, bench: Users };
const byPlayer = Object.fromEntries(PLAYERS.map(p => [p.id, p]));
const bySeason = Object.fromEntries(SEASONS.map(s => [s.id, s]));
const byRegion = Object.fromEntries(REGIONS.map(r => [r.id, r]));
const byRole = Object.fromEntries(SLOTS.map(r => [r.id, r]));
const emptyTeam = () => Object.fromEntries(SLOTS.map(r => [r.id, null]));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ } };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const fresh = (mode = 'free', seed, rulesVersion = 2) => {
  const date = mode === 'daily' && typeof seed === 'string' ? seed.match(/^worlds-daily:(\d{4}-\d{2}-\d{2})$/)?.[1] : undefined;
  return { version: 3, game: createGame({ mode, seed, date, rulesVersion }), team: emptyTeam(), drawIndex: 0, rerolls: 0, completed: false, legacyFixed: rulesVersion === 1, teamName: '', nameConfirmed: false, onlineRunId: null, actions: [] };
};

function initialState() {
  const params = new URLSearchParams(location.search);
  const seed = params.get('wseed');
  let requested = null;
  try { requested = seed && seed.length < 160 ? fresh(params.get('mode') === 'daily' ? 'daily' : 'free', seed, params.get('wrules') === '1' ? 1 : 2) : null; } catch { /* Invalid challenge links fall back to local progress. */ }
  const saved = read(SAVE_KEY, null);
  try {
    if (![1, 2, 3].includes(saved?.version) || typeof saved.game?.seed !== 'string' || saved.game.seed.length >= 160 || !['free', 'daily'].includes(saved.game.mode)) throw Error();
    const canonical = createGame({ seed: saved.game.seed, mode: saved.game.mode, date: saved.game.day, rulesVersion: saved.game.rulesVersion ?? 1, roundIndex: saved.game.roundIndex ?? 0 });
    const picks = Object.values(saved.team || {});
    const chosen = picks.filter(Boolean).map(id => byPlayer[id]);
    if (Object.keys(saved.team).length !== 6 || !SLOTS.every(r => r.id in saved.team && (saved.team[r.id] === null || typeof saved.team[r.id] === 'string')) || chosen.some(p => !p)) throw Error();
    if (canonical.rulesVersion === 1 && chosen.some(p => p.seasonId !== canonical.seasonId || p.region !== canonical.regionId)) throw Error();
    if (canonical.rulesVersion === 2 && canonical.roundIndex !== Math.min(chosen.length, 5)) throw Error();
    if (new Set(chosen.map(p => p.identity)).size !== chosen.length || !Number.isInteger(saved.rerolls) || saved.rerolls < 0 || saved.rerolls > 2 || saved.drawIndex !== chosen.length + saved.rerolls) throw Error();
    if (typeof saved.completed !== 'boolean' || (saved.completed && chosen.length !== 6) || saved.game.seasonId !== canonical.seasonId || saved.game.regionId !== canonical.regionId) throw Error();
    if (canonical.mode === 'daily' && (saved.rerolls !== 0 || (!requested && canonical.day !== today()))) throw Error();
    if (requested && (requested.game.seed !== canonical.seed || requested.game.mode !== canonical.mode || (params.has('wrules') && requested.game.rulesVersion !== canonical.rulesVersion))) throw Error();
    const teamName = typeof saved.teamName === 'string' ? [...saved.teamName.trim()].slice(0, 16).join('') : '';
    const nameConfirmed = saved.version === 3 ? !!saved.nameConfirmed && !!teamName : chosen.length > 0;
    return { restored: true, state: { ...saved, version: 3, game: canonical, teamName: nameConfirmed ? teamName || '新生战队' : '', nameConfirmed, onlineRunId: saved.onlineRunId || null, actions: Array.isArray(saved.actions) ? saved.actions : [] } };
  } catch { return { restored: false, state: requested || fresh() }; }
}

function Cup({ className = '' }) {
  return <svg className={className} viewBox="0 0 160 190" fill="none" aria-hidden="true"><defs><linearGradient id="cup-metal" x1="30" y1="20" x2="135" y2="175" gradientUnits="userSpaceOnUse"><stop stopColor="#f2ffc8"/><stop offset=".45" stopColor="#a3bd83"/><stop offset=".5" stopColor="#56695b"/><stop offset="1" stopColor="#d5e3ba"/></linearGradient></defs><path d="M47 35H16l8 48 34 20M113 35h31l-8 48-34 20" stroke="url(#cup-metal)" strokeWidth="7"/><path d="m42 19 76 0-12 81-26 21-26-21z" fill="url(#cup-metal)"/><path d="m48 26 32 9 32-9-11 70-21 18-21-18z" fill="#142723"/><path d="m80 39 16 17-16 37-16-37z" fill="#cefa79"/><path d="m80 45 6 14-6 22-6-22z" fill="#efffd6"/><path d="M74 119h12v29l15 10H59l15-10zM48 159h64v14H48z" fill="url(#cup-metal)"/><path d="M37 180h86" stroke="#c9fa74" strokeWidth="2"/><path d="m59 12 21-7 21 7M7 112l17 12m129-12-17 12" stroke="#cad5b2" strokeOpacity=".5" strokeWidth="2"/></svg>;
}

function RoleIcon({ role, size = 18 }) { const Icon = roleIcons[role] || Users; return <Icon size={size}/>; }

function PlayerAttributes({ player }) {
  return <section className="position-player-stats" aria-label={`${player.name}的六维能力`}><div className="position-stats-heading"><span>选手能力 · {bySeason[player.seasonId].label}</span><strong><small>OVR</small>{player.rating}</strong></div><div className="profile-stats">{STAT_KEYS.map(key => <div key={key}><span>{STAT_LABELS[key]}</span><b>{player.stats[key]}</b><i style={{ width: `${player.stats[key]}%` }}/></div>)}</div></section>;
}

function Jersey({ player, small = false, showRating = true }) {
  const color = byRegion[player.region]?.color || '#8fbbcf';
  return <div className={`jersey ${small ? 'small' : ''}`} style={{ '--jersey-color': color }} aria-hidden="true"><svg viewBox="0 0 120 108" fill="none"><path d="m38 12-26 17 10 27 17-8v54h42V48l17 8 10-27-26-17-22 8z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeOpacity=".5"/><path d="m38 12 22 8 22-8-9 16H47z" fill="#0a111c" stroke="currentColor" strokeOpacity=".4"/><path d="m22 29 17 11M98 29 81 40M43 90h34M45 94h30" stroke="currentColor" strokeOpacity=".3"/><path d="M41 49h38" stroke="currentColor" strokeOpacity=".22"/><text x="60" y="45" textAnchor="middle" fill="currentColor" fontSize="11" fontFamily="Arial" fontWeight="800">{player.team}</text>{showRating && <text x="60" y="79" textAnchor="middle" fill="currentColor" fontSize="26" fontFamily="Arial" fontWeight="800">{player.rating}</text>}<path d="m44 53 5 29M76 53l-5 29" stroke="currentColor" strokeOpacity=".18"/></svg></div>;
}

function Modal({ title, eyebrow, children, close, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { const before = document.activeElement; ref.current?.showModal(); return () => { if (before?.isConnected) before.focus?.({ preventScroll: true }); }; }, []);
  return <dialog ref={ref} className={`w-modal ${wide ? 'wide' : ''}`} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-btn" aria-label="关闭弹窗" onClick={close}><X size={20}/></button></header><div className="modal-body">{children}</div></dialog>;
}

function DrawReel({ entries, selectedId, rolling, title, label, onSettled }) {
  const stop = entries.length * 3 + Math.max(0, entries.findIndex(e => e.id === selectedId));
  return <div className={`draw-reel ${rolling ? 'rolling' : ''}`} aria-label={`${title}：${entries.find(e => e.id === selectedId)?.name || selectedId}`}><span>{title}<small>{label}</small></span><div className="reel-window" aria-hidden="true"><div className="reel-track" style={{ '--stop': stop }} onAnimationEnd={event => { if (rolling && event.target === event.currentTarget && event.animationName === 'reel-spin') onSettled?.(); }}>{Array.from({ length: stop + 2 }, (_, i) => <strong key={i}>{entries[i % entries.length]?.label || entries[i % entries.length]?.id}</strong>)}</div></div><ChevronDown size={16}/></div>;
}

function CandidateTable({ candidates, rolling, select, drawKey }) {
  const [sort, setSort] = useState('');
  const scroll = useRef(null);
  useEffect(() => { setSort(''); if (scroll.current) scroll.current.scrollLeft = 0; }, [drawKey]);
  const ordered = useMemo(() => sort ? [...candidates].sort((a, b) => b.stats[sort] - a.stats[sort]) : candidates, [candidates, sort]);
  const maxima = Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(...candidates.map(p => p.stats[k]))]));
  if (rolling) return <section className="candidate-panel" aria-label="本轮六名候选选手" aria-busy="true"><div className="table-caption"><span><i/> 六名候选，即将揭晓</span></div><div className="candidate-wait" role="status"><LoaderCircle size={27} className="spin"/><p>等待赛季与赛区揭晓</p></div></section>;
  return <section className="candidate-panel candidates-ready" aria-label="本轮六名候选选手" aria-busy={rolling}><div className="table-caption"><span><i/> 六名候选，一次选择</span><span>点击属性排序 <span className="max-key"/> 本轮最高</span></div><div className="candidates-scroll" ref={scroll} role="region" aria-label="六名选手能力对比，可左右滑动" tabIndex={0}><table><caption className="sr-only">每轮六名候选。点击选手选择位置，点击属性名称排序。所有数值为游戏设计。</caption><thead><tr><th scope="col" className="pinned identity-label"><span>候选<br/>选手</span><small>DRAFT<br/>PLAYER</small></th>{ordered.map(p => <th scope="col" key={p.id}><button className="player-card" onClick={() => select(p)} disabled={rolling} aria-label={`招募 ${p.name}`} onFocus={e => { const parent = scroll.current; const cell = e.currentTarget.closest('th'); if (cell.getBoundingClientRect().left < parent.getBoundingClientRect().left + 70 || cell.getBoundingClientRect().right > parent.getBoundingClientRect().right) parent.scrollLeft = cell.offsetLeft - 70; }}><span className="player-card-top"><b>{p.team}</b><span>{byRole[p.role]?.short}</span></span><Jersey player={p}/><span className="player-name" title={p.name}>{p.name}</span><span className="native-role"><RoleIcon role={p.role} size={11}/>{byRole[p.role]?.name} · {bySeason[p.seasonId]?.label}</span><span className="player-rating">OVR <b>{p.rating}</b></span></button></th>)}</tr></thead><tbody>{STAT_KEYS.map(k => <tr key={k}><th scope="row" className="pinned"><button onClick={() => setSort(s => s === k ? '' : k)} aria-label={`按${STAT_LABELS[k]}排序`} aria-pressed={sort === k}>{STAT_LABELS[k]}<span>{sort === k ? '↓' : '↕'}</span></button></th>{ordered.map(p => <td key={p.id} className={p.stats[k] === maxima[k] ? 'highest' : ''}><b>{p.stats[k]}</b><span className="stat-line"><i style={{ width: `${p.stats[k]}%` }}/></span></td>)}</tr>)}<tr className="trait-row"><th scope="row" className="pinned">风格</th>{ordered.map(p => <td key={p.id}><span>{p.tags?.[0] || '职业选手'}</span></td>)}</tr><tr className="recruit-row"><th className="pinned" scope="row"><span>6 选 1</span></th>{ordered.map(p => <td key={p.id}><button className="recruit-btn" onClick={() => select(p)} disabled={rolling}>招募<ArrowRight size={13}/></button></td>)}</tr></tbody></table></div></section>;
}

function Roster({ team, analysis, count, state, onSlot, result, resolving }) {
  return <aside className="roster-panel"><div className="roster-top"><div className="team-crest"><span>W</span><small>EST. 2026</small></div><span className="eyebrow">YOUR ORGANIZATION</span><h2 className="team-name">{state.teamName || '等待战队成立'}</h2><div className="team-subline"><span>{count < 6 ? '跨赛季阵容' : `${state.game.regionId} 代表队`}</span><i/><span>{count < 6 ? '出征归属待定' : '2026 · S16 世界赛'}</span></div></div><div className="roster-section-heading"><b>出征名单</b><span>{count} / 6 SIGNED</span></div><div className="roster-slots">{SLOTS.map((r, i) => { const p = team[r.id]; const score = p ? Math.round(roleScore(p, r.id)) : null; return <button key={r.id} className={`roster-slot ${p ? 'filled' : ''} ${r.id === 'bench' ? 'bench-slot' : ''}`} onClick={() => p && onSlot(r.id)} disabled={!p || !!result || resolving} aria-label={p ? `${r.name} ${p.name}，${result ? '阵容已锁定' : '调整位置'}` : `${r.name}等待招募`}><span className="slot-symbol"><RoleIcon role={r.id} size={19}/></span><span className="slot-copy"><span>{r.name}<small>{r.short}</small></span><strong>{p?.name || '等待签约'}</strong><small title={p ? `${bySeason[p.seasonId]?.label} · ${p.region} · ${p.team} · 原位${byRole[p.role]?.name}` : undefined}>{p ? `${bySeason[p.seasonId]?.label} · ${p.region} · ${p.team}` : r.id === 'bench' ? '为关键时刻保留底牌' : '从候选中选择一位选手'}</small></span><span className={`slot-rating ${p && p.role !== r.id && r.id !== 'bench' ? 'off-role' : ''}`}>{p ? score : <span className="slot-plus">+</span>}{p && <small>适配</small>}</span></button>; })}</div><div className="roster-summary"><div><span>战队战力 <Info size={12}/></span><strong>{count ? analysis.rating.toFixed(1) : '—'}<small> / 100</small></strong></div><div className="power-track"><i style={{ width: `${analysis.rating || 0}%` }}/></div><div className="roster-bonuses"><span>磨合 <b>+{Number(analysis.synergy || 0).toFixed(1)}</b></span><span>替补深度 <b>+{Number(analysis.benchBonus || 0).toFixed(1)}</b></span></div></div><p className="roster-hint"><Shuffle size={12}/>{result ? '出征阵容已锁定' : '点击已签约选手，可互换位置'}</p></aside>;
}

function App() {
  const [initial] = useState(initialState);
  const [state, setState] = useState(initial.state);
  const [rolling, setRolling] = useState(!initial.restored && !!initial.state.nameConfirmed);
  const [nameDraft, setNameDraft] = useState(initial.state.teamName || '');
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [resolving, setResolving] = useState(false);
  const [records, setRecords] = useState(() => { const rows = read(HISTORY_KEY, []); return Array.isArray(rows) ? rows.filter(r => typeof r?.id === 'string' && typeof r.placement === 'string' && Array.isArray(r.names)).slice(0, 12) : []; });
  const timer = useRef(null);
  const settledReels = useRef({ drawKey: null, ids: new Set() });
  const team = useMemo(() => Object.fromEntries(SLOTS.map(r => [r.id, byPlayer[state.team[r.id]] || null])), [state.team]);
  const count = Object.values(team).filter(Boolean).length;
  const complete = count === 6;
  const analysis = useMemo(() => evaluateTeam(team), [team]);
  const season = bySeason[state.game.seasonId];
  const region = byRegion[state.game.regionId];
  const pool = PLAYERS.filter(p => p.seasonId === season.id && p.region === region.id);
  const candidates = useMemo(() => complete || !state.nameConfirmed ? [] : drawCandidates(state.game, team, state.drawIndex), [state.game, team, state.drawIndex, complete, state.nameConfirmed]);
  const result = useMemo(() => state.completed && complete ? simulateWorlds2026(state.game, team) : null, [state.completed, state.game, team, complete]);
  const daily = state.game.mode === 'daily';
  useEffect(() => write(SAVE_KEY, state), [state]);
  // Animation events release the candidates only after both reels have stopped.
  // The timeout also covers browsers that suppress animation events entirely.
  useEffect(() => { if (!rolling) return; const id = setTimeout(() => setRolling(false), 2000); return () => clearTimeout(id); }, [rolling, state.drawIndex, state.game.seed]);
  const settleReel = reel => {
    const drawKey = `${state.game.seed}:${state.drawIndex}`;
    if (settledReels.current.drawKey !== drawKey) settledReels.current = { drawKey, ids: new Set() };
    settledReels.current.ids.add(reel);
    if (settledReels.current.ids.size === 2) setRolling(false);
  };
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = text => setToast(text);
  const reset = (mode = state.game.mode, seed) => { if (publishing || creating) return; clearTimeout(timer.current); setState(fresh(mode, seed)); setNameDraft(state.teamName || ''); setNameError(''); setPublishError(''); setRolling(false); setResolving(false); setModal(null); if (location.search) history.replaceState(null, '', location.pathname); };
  const startDraft = async e => {
    e.preventDefault();
    if (creating) return;
    const name = nameDraft.trim();
    if (!name || [...name].length > 16 || /[\u0000-\u001f\u007f]/u.test(name)) { setNameError('请输入 1–16 个字的战队名称。'); return; }
    setCreating(true); setNameError('');
    try {
      const params = new URLSearchParams(location.search);
      const online = await createOnlineRun({ teamName: name, mode: state.game.mode, ...(params.get('wseed') && { seed: params.get('wseed') }) });
      setState({ ...fresh(state.game.mode, online.game.seed), game: online.game, teamName: online.teamName, nameConfirmed: true, onlineRunId: online.runId });
      setRolling(true);
    } catch (error) { setNameError(error.message || '暂时无法开始选秀，请稍后重试。'); }
    finally { setCreating(false); }
  };
  const requestNew = mode => { if (resolving || publishing || creating) return; if (count && !result) setModal({ type: 'restart', mode }); else reset(mode); };
  const reroll = () => { if (!state.nameConfirmed || rolling || complete || daily || state.rerolls >= 2) return; setRolling(true); setState(s => ({ ...s, drawIndex: s.drawIndex + 1, rerolls: s.rerolls + 1 })); };
  const pick = (player, slot) => {
    if (!state.nameConfirmed || rolling || complete || !SLOTS.some(r => r.id === slot) || state.team[slot] || !candidates.some(p => p.id === player.id)) return;
    setState(s => {
      const nextTeam = { ...s.team, [slot]: player.id };
      const nextCount = Object.values(nextTeam).filter(Boolean).length;
      return { ...s, version: 3, game: nextCount < 6 && !s.legacyFixed ? gameAtRound({ ...s.game, rulesVersion: 2 }, nextCount) : s.game, team: nextTeam, actions: [...s.actions, { playerId: player.id, drawIndex: s.drawIndex }], drawIndex: s.drawIndex + 1 };
    });
    setModal(null);
    if (count < 5) setRolling(true);
    else notify('六人签约完成，准备出征 2026 全球总决赛。');
  };
  const swap = (a, b) => { if (result || resolving || a === b) return; setState(s => ({ ...s, team: { ...s.team, [a]: s.team[b], [b]: s.team[a] } })); setModal(null); notify('位置已调整，首发与替补能力已重新计算。'); };
  const publishResult = async () => {
    if (!state.onlineRunId || publishing || state.leaderboardEntryId) return;
    setPublishing(true); setPublishError('');
    try {
      const response = await submitOnlineRun({ runId: state.onlineRunId, actions: state.actions, team: state.team });
      setState(s => s.onlineRunId === state.onlineRunId ? { ...s, leaderboardEntryId: response.entry.id } : s);
    } catch (error) { setPublishError(error.message || '成绩暂未上传，请重试。'); }
    finally { setPublishing(false); }
  };
  const run = () => {
    if (!complete || resolving || result) return;
    setResolving(true);
    timer.current = setTimeout(() => {
      const output = simulateWorlds2026(state.game, team);
      const id = `${state.game.seed}:${SLOTS.map(r => state.team[r.id]).join(':')}`;
      const entry = { id, day: today(), teamName: state.teamName || '新生战队', season: '2026 · S16', region: region.id, placement: output.placement, names: SLOTS.map(r => `${team[r.id].name}（${bySeason[team[r.id].seasonId].label} · ${team[r.id].region}）`) };
      setRecords(old => { const next = [entry, ...old.filter(r => r.id !== id)].slice(0, 12); write(HISTORY_KEY, next); return next; });
      setState(s => ({ ...s, completed: true })); setResolving(false);
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, 1300);
  };
  useEffect(() => { if (state.completed && state.onlineRunId && !state.leaderboardEntryId) publishResult(); }, [state.completed, state.onlineRunId]);
  const copy = async value => { try { await navigator.clipboard.writeText(value); notify('已复制，可分享给好友。'); } catch { notify('当前浏览器无法自动复制，可直接复制地址栏链接。'); } };
  const link = `${location.origin}${location.pathname}?wseed=${encodeURIComponent(state.game.seed)}${daily ? '&mode=daily' : ''}&wrules=${state.game.rulesVersion}`;
  const share = () => copy(`WORLDS DRAFT · ${state.teamName || '新生战队'}\n2026（S16）全球总决赛 · ${region.id} · ${result.placement}\n${SLOTS.map(r => `${r.name} ${team[r.id].name}（${bySeason[team[r.id].seasonId].label} · ${team[r.id].region}）`).join(' / ')}\n相同的六轮赛签，你能走多远？\n${link}`);
  const close = () => setModal(null);
  const selected = modal?.playerId ? byPlayer[modal.playerId] : null;

  return <><header className="w-header"><a href="./" className="w-brand" onClick={e => { e.preventDefault(); close(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Worlds Draft 首页"><span className="brand-icon"><Trophy size={22}/></span><span>WORLDS<span className="brand-light">DRAFT</span><small>世界赛 · 战队选秀</small></span></a><nav aria-label="主导航"><button className="active" onClick={close}>战队组建</button><button onClick={() => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' })}>全球排行榜<ArrowUpRight size={12}/></button><button onClick={() => setModal({ type: 'rules' })}>玩法说明</button></nav><div className="header-actions"><button className="history-btn" onClick={() => setModal({ type: 'history' })}><History size={15}/><span>出征记录</span></button></div></header>
    <main className="w-shell"><section className="w-hero"><div className="hero-heading"><span className="eyebrow"><span className="live-dot"/> BUILD YOUR FIVE. CHASE THE CROWN.</span><h1>组建你的战队，<span>向世界之巅。</span></h1><p>随机赛季与赛区 · 六轮签约 · 五名首发，一个冠军梦。</p></div><div className="hero-trophy"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><Cup/><span className="trophy-caption">THE SUMMONER'S DREAM</span></div><div className="hero-facts"><span>CLASSIC SEASONS</span><strong>S11<span>—</span>S14</strong><small>重返四届世界赛</small></div></section>
      <div className="game-toolbar"><div className="mode-switch" aria-label="挑战模式"><button className={!daily ? 'active' : ''} disabled={resolving || creating || publishing} onClick={() => daily && requestNew('free')}><Dices size={14}/>自由选秀</button><button className={daily ? 'active' : ''} disabled={resolving || creating || publishing} onClick={() => !daily && requestNew('daily')}><Globe2 size={14}/>每日同签</button></div><span className="autosave"><span className="live-dot"/>{daily ? `${state.game.day} · 六轮相同赛签` : '进度自动保存，刷新可继续'}</span><button className="quiet-btn restart-game" disabled={resolving || creating || publishing} onClick={() => requestNew(state.game.mode)}><RefreshCw size={14}/>{daily ? '重试今日挑战' : '随机新一局'}</button></div>
      <div className="draft-layout"><div className="draft-main">{result ? <><div className="section-heading"><h2><span className="section-index">01</span>世界赛战报</h2><span className="status-tag"><Check size={12}/>征程结束</span></div><section className={`result-card ${result.rank === 1 ? 'champion' : ''}`} aria-label="世界赛最终名次"><div><span className="eyebrow">2026 WORLDS / S16 FINAL PLACEMENT</span><span className="result-team">{state.teamName || '新生战队'} <small>{region.id}</small></span><h2>{result.placement}</h2><p>{result.stage} · 小局战绩 {result.record.wins} 胜 {result.record.losses} 负</p></div><Cup/><div className="result-bottom"><span><Sparkles size={14}/>{result.rank === 1 ? '这一次，冠军属于你。' : result.rank <= 5 ? '每一次突破，都值得被记住。' : '世界赛的故事，下一次继续。'}</span><span>TEAM OVR <b>{Number(result.rating ?? analysis.rating).toFixed(1)}</b></span></div></section><div className="result-actions"><button className="primary-btn" onClick={share}><Copy size={15}/>分享战报<ArrowUpRight size={15}/></button><button className="secondary-btn" disabled={publishing} onClick={() => reset()}><RefreshCw size={15}/>再组一支战队</button></div><div className="section-heading match-heading"><h2><span className="section-index">02</span>晋级之路</h2><span>同赛签 · 同阵容 · 同结果</span></div><div className="match-log">{result.matches.map((m, i) => <details className={m.won ? 'match-win' : 'match-loss'} key={m.id || i}><summary><span className="match-order">{String(i + 1).padStart(2, '0')}</span><span className="match-stage">{m.stage}</span><span className="match-opponent"><small>VS</small> {typeof m.opponent === 'object' ? m.opponent.tag : m.opponent}</span><span className="match-score">{m.wins} <i>:</i> {m.losses}</span><span className="match-outcome">{m.won ? '胜' : '负'}</span><ChevronDown size={13}/></summary><div className="match-explanation"><p>{m.reason}</p><span>{m.format} · 对手战力 {Number(m.opponentRating).toFixed(1)}</span></div></details>)}</div><div className="debrief"><h3><Layers3 size={16}/>赛后复盘</h3>{analysis.strengths.map((s, i) => <p key={i}><Check size={13}/>{s}</p>)}{analysis.weaknesses.map((s, i) => <p className="warning" key={i}><Info size={13}/>{s}</p>)}<p className="simulation-note">{result.simulationNote}</p></div></> : !state.nameConfirmed ? <section className="name-panel" aria-labelledby="team-naming-title"><span className="name-emblem"><Trophy size={36}/></span><span className="eyebrow">EVERY LEGEND STARTS WITH A NAME.</span><h2 id="team-naming-title">先给你的战队一个名字。</h2><p>集结跨时代的六位选手，<br/>以你的名字，出征 2026 全球总决赛。</p><form onSubmit={startDraft}><label htmlFor="new-team-name">战队名称 <span>1–16 字</span></label><input id="new-team-name" name="teamName" value={nameDraft} maxLength={32} autoComplete="off" placeholder="输入你的战队名称" disabled={creating} onChange={e => { setNameDraft(e.target.value); setNameError(''); }} aria-describedby={nameError ? 'team-name-error' : undefined} aria-invalid={!!nameError}/>{nameError && <p className="form-error" id="team-name-error" role="alert">{nameError}</p>}<button className="primary-btn" type="submit" disabled={creating || !nameDraft.trim()}>{creating ? <><LoaderCircle size={17} className="spin"/>正在成立战队…</> : <>成立战队，开始抽取<ArrowRight size={17}/></>}</button></form><small>完成世界赛后，你的战队名称和成绩将公开展示在排行榜。</small></section> : <><div className="section-heading"><h2><span className="section-index">01</span>{complete ? '第六轮选秀赛签' : '本轮赛季与赛区'}</h2><span className="round-label">ROUND <b>{String(Math.min(count + 1, 6)).padStart(2, '0')}</b> / 06</span></div><section className="event-draw" aria-label={complete ? '第六轮选秀赛签' : '本轮赛季与赛区'}><div className="event-draw-slots"><DrawReel key={`season:${state.drawIndex}`} title="赛季" label="SEASON" entries={SEASONS} selectedId={season.id} rolling={rolling} onSettled={() => settleReel('season')}/><span className="draw-cross">×</span><DrawReel key={`region:${state.drawIndex}`} title="赛区" label="REGION" entries={REGIONS.filter(r => AVAILABLE_POOLS.some(p => p.seasonId === season.id && p.regionId === r.id))} selectedId={region.id} rolling={rolling} onSettled={() => settleReel('region')}/></div><div className="event-context"><span>{season.year} 全球总决赛</span><b>{region.name}</b><span className="pool-size">{pool.length} 名参赛选手</span></div><div className="event-draw-bottom"><span><Trophy size={13}/>历史冠军 <b>{season.champion}</b></span><span>{complete ? '出征 2026 · S16 世界赛' : '签下一人后，重抽赛季与赛区'}</span></div></section><div className="section-heading candidates-heading"><h2><span className="section-index">02</span>{complete ? '出征准备' : '签下你的下一位选手'}</h2>{!complete && <button className="reroll-btn" onClick={reroll} disabled={rolling || daily || state.rerolls >= 2}><Shuffle size={13}/>{daily ? '每日模式无重抽' : `重抽候选 ${2 - state.rerolls}/2`}</button>}</div>{complete ? <section className="ready-panel"><span className="ready-icon"><Check size={28}/></span><span className="eyebrow">ALL SIX. ALL IN.</span><h2>六人就位，世界赛见。</h2><p>本次出征：2026（S16）全球总决赛 · {region.id}。<br/>选手保留各自赛季能力，点击阵容可互换位置。</p><div className="ready-stats"><span>首发席位<b>5 / 5</b></span><span>替补席位<b>1 / 1</b></span><span>战队战力<b>{analysis.rating.toFixed(1)}</b></span></div><button className="primary-btn launch-btn" onClick={run} disabled={resolving}>{resolving ? <><LoaderCircle size={18} className="spin"/>正在模拟世界赛…</> : <><Trophy size={18}/>出征全球总决赛<ArrowRight size={18}/></>}</button><small>瑞士轮 → 八强淘汰赛，最终名次由比赛胜负决定。</small></section> : <><CandidateTable candidates={candidates} rolling={rolling} select={p => !rolling && setModal({ type: 'recruit', playerId: p.id })} drawKey={`${state.game.seed}:${state.drawIndex}`}/><div className="draft-footer"><span>{rolling ? <><LoaderCircle size={13} className="spin"/>正在揭晓候选名单…</> : <><Info size={13}/>只抽 {season.label} · {region.id} 实际参赛选手，已签约选手不重复出现。</>}</span><span>{count + 1} / 6 次签约</span></div></>}<div className="journey-strip"><div><span className={count < 6 ? 'active' : ''}>01</span><p>抽签选秀<small>每轮六选一</small></p></div><ArrowRight size={14}/><div><span className={complete ? 'active' : ''}>02</span><p>排兵布阵<small>五首发 + 一替补</small></p></div><ArrowRight size={14}/><div><span>03</span><p>挑战世界赛<small>由胜负决定名次</small></p></div></div></>}</div><Roster team={team} analysis={analysis} count={count} state={state} onSlot={slot => setModal({ type: 'swap', slot })} result={result} resolving={resolving}/></div>
      {result && <div className="publish-status" role="status">{publishing ? <><LoaderCircle size={14} className="spin"/>正在提交世界赛成绩…</> : state.leaderboardEntryId ? <><Check size={14}/>成绩已加入全球排行榜</> : publishError ? <><Info size={14}/><span>{publishError}</span><button className="quiet-btn" onClick={publishResult}>重试上传</button></> : !state.onlineRunId ? <><Info size={14}/>旧版存档成绩保留在本地；开始新一局即可参与全球排行榜。</> : null}</div>}<Leaderboard entryId={state.leaderboardEntryId} refreshKey={state.completed}/><footer className="w-footer"><span><Trophy size={13}/> WORLDS DRAFT <i>/</i> 一个关于选择与配合的世界赛模拟器</span><button onClick={() => setModal({ type: 'sources' })}>数据与评分说明<ArrowUpRight size={12}/></button><small>非官方同人原型 · 评分为游戏估值</small></footer>
    </main>
    {toast && <div className="w-toast" role="status"><Check size={15}/>{toast}</div>}
    {modal?.type === 'recruit' && selected && <Modal title={`签约 ${selected.name}`} eyebrow={`${season.label} / ${selected.team}`} close={close}><div className="recruit-profile"><Jersey player={selected} showRating={false}/><div><span className="eyebrow">PLAYER SCOUTING</span><h3>{selected.name}</h3></div></div><PlayerAttributes player={selected}/><div className="modal-section-label">选择位置</div><div className="role-choices">{SLOTS.map(r => <button key={r.id} onClick={() => pick(selected, r.id)} disabled={!!team[r.id]} aria-label={`${selected.name}担任${r.name}`}><RoleIcon role={r.id}/><span><strong>{r.name}</strong>{team[r.id] && <small>{team[r.id].name}</small>}</span></button>)}</div></Modal>}
    {modal?.type === 'swap' && <Modal title={`调整 ${team[modal.slot]?.name} 的位置`} eyebrow="ROSTER MANAGEMENT" close={close}><PlayerAttributes player={team[modal.slot]}/><div className="role-choices">{SLOTS.map(r => <button key={r.id} disabled={r.id === modal.slot} onClick={() => swap(modal.slot, r.id)}><RoleIcon role={r.id}/><span><strong>{r.name}</strong>{(r.id === modal.slot || team[r.id]) && <small>{r.id === modal.slot ? '当前位置' : team[r.id].name}</small>}</span></button>)}</div></Modal>}
    
    {modal?.type === 'rules' && <Modal title="六次选择，改写世界赛。" eyebrow="HOW TO PLAY" close={close} wide><div className="rules-grid"><article><span>01</span><h3>每轮重抽赛季与赛区</h3><p>每次签下一名选手后，下一轮重新随机 S11–S14 赛季和可用赛区。每轮只抽该签对应赛季、赛区的实际登场选手。</p></article><article><span>02</span><h3>六轮，每次六选一</h3><p>每轮等概率抽 6 名未签约选手，选择 1 人安排位置。共签约 6 人：上路、打野、中路、下路、辅助和替补。同一选手的不同赛季版本也不能重复入队。</p></article><article><span>03</span><h3>把对的人放在对的位置</h3><p>原位选手可充分发挥，跨位置出场会折损适配。点击阵容中已签约选手可互换位置，替补会提供有限的阵容深度加成。</p></article><article><span>04</span><h3>打出你的最终名次</h3><p>第六轮赛签决定战队归属赛区，所有队伍统一出征 2026（S16）全球总决赛。选手保留各自赛季能力；瑞士轮三胜晋级、三负淘汰，出线后打 BO5，最终按胜负结算名次。</p></article></div><div className="rules-notes"><p><Info size={14}/>为保证最后一轮仍有 6 名未签约候选，仅开放至少 11 名独立登场选手的赛区池。首次抽取前需填写队名，结算后成绩自动加入全球排行榜。</p><p><RefreshCw size={14}/>自由模式有 2 次候选重抽，只重抽本轮候选。每次签约后才进入下一轮、重抽赛季和赛区。每日模式按上海日期固定六轮签序，不提供候选重抽。取消、换位和刷新均不改签。</p><p><Layers3 size={14}/>历史名单与成绩用于参考，六维评分、位置折损、磨合和比赛概率均为游戏设计；统一采用 2026 正赛框架，对手使用 S14 历史阵容。</p></div></Modal>}
    {modal?.type === 'sources' && <Modal title="名单有出处，评分有口径。" eyebrow="DATA & METHODOLOGY" close={close} wide><p className="modal-intro">首版收录 2021–2024 四届世界赛的 {TEAMS.length} 份战队档案、{PLAYERS.length} 份赛季选手档案，包含入围赛与正赛实际上场选手，不含未登场的报名替补。</p><div className="source-method"><h3>六维能力与赛季差异</h3><p>操作、对线、团战、运营、视野与稳定性共同构成能力档案。参考当届比赛统计、队伍成绩与选手位置风格设计，不同年份分别估值。它们不是 Riot 官方评分，也不是真实选手实力的权威排名。</p><h3>比赛如何决定结果</h3><p>首发位置适配组成基础战力，团队磨合与替补深度提供小幅加成。每场比赛结合对手强度和由赛签固定的临场发挥决定胜负，再按照晋级路径给出名次。刷新不改变结果。</p></div><div className="source-links">{SOURCES.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer"><span>{s.label}</span><ArrowUpRight size={14}/></a>)}</div></Modal>}
    {modal?.type === 'history' && <Modal title="每一次出征，都算数。" eyebrow="RECENT CAMPAIGNS / 最近 12 次" close={close} wide>{records.length ? <div className="records-list">{records.map(r => <article key={r.id}><span className="record-icon"><Trophy size={20}/></span><div><small>{r.day} · {r.season} · {r.region}</small><h3>{r.teamName}</h3><p>{r.names.join(' / ')}</p></div><strong>{r.placement}</strong></article>)}</div> : <div className="empty-records"><Trophy size={38}/><h3>第一份世界赛战报，等你书写。</h3><p>签下六名选手并完成世界赛，战报就会保存在这里。</p><button className="primary-btn" onClick={close}>去组建战队<ArrowRight size={15}/></button></div>}<p className="subtle-note">记录仅保存在当前浏览器。</p></Modal>}
    {modal?.type === 'restart' && <Modal title="开始新一轮选秀？" eyebrow="NEW CAMPAIGN" close={close}><p className="modal-intro">本局已签约 {count} 名选手。开始新局会重置当前阵容，已完成的出征记录会保留。</p><div className="confirm-actions"><button className="secondary-btn" onClick={close}>继续本局</button><button className="primary-btn" onClick={() => reset(modal.mode)}>开始新局<ArrowRight size={15}/></button></div></Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
