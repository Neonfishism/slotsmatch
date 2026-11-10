import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Crosshair, Dices, Flag, History, Info, LoaderCircle, RotateCcw, Search, Shield, Sparkles, Swords, Target, Trophy, Users, Wind, X } from 'lucide-react';
import { NINJAS, VILLAGES, ROLES, STAT_KEYS, STAT_LABELS } from './data.js';
import { DRAFT_POOLS, ERAS, NINJA_VERSIONS } from './eras.js';
import { createGame, createMissionPlan, drawCandidates, evaluateTeam, roleScore, simulateMissions } from './engine.js';
import './styles.css';
import './interactions.css';
import './compact.css';
import './comparison.css';
import './eras.css';

const SAVE_KEY = 'nindo-draft-v1';
const HISTORY_KEY = 'nindo-records-v1';
const DRAW_DURATION_MS = 1600;
const emptyTeam = () => Object.fromEntries(ROLES.map(role => [role.id, null]));
const roleIcons = { captain: Flag, scout: Crosshair, assault: Swords, support: Shield };
const villageById = Object.fromEntries(VILLAGES.map(v => [v.id, v]));
const baseNinjaById = Object.fromEntries(NINJAS.map(n => [n.id, n]));
const ninjaById = Object.fromEntries(NINJA_VERSIONS.map(n => [n.id, n]));
const eraById = Object.fromEntries(ERAS.map(era => [era.id, era]));
const traitLabels = { medical: '医疗', sensor: '感知', tactics: '战术', seal: '封印', guard: '守护', ranged: '远程', assault: '强攻', stealth: '隐匿' };
const missionFocus = { 潜入: '侦察 40% · 队长 25% · 支援 20% · 突破 15%', 追踪: '队长 35% · 侦察 35% · 突破 15% · 支援 15%', 强袭: '突破 45% · 队长 20% · 支援 20% · 侦察 15%', 护送: '支援 40% · 队长 25% · 突破 20% · 侦察 15%' };
const paint = {
  naruto: ['#f0c15e', '#d9843c'], sasuke: ['#252c36', '#555b78'], sakura: ['#d5999c', '#9c5262'],
  kakashi: ['#c1c5be', '#667a66'], shikamaru: ['#292d25', '#7b8263'], hinata: ['#353243', '#b4a7bf'],
  neji: ['#46382c', '#c9c5af'], lee: ['#272d26', '#527a53'], tsunade: ['#d4bd71', '#688366'],
  jiraiya: ['#dedbd0', '#a26453'], itachi: ['#252a2d', '#9b5149'], gaara: ['#9b5041', '#a48c69'],
  temari: ['#c9b772', '#76758b'], kankuro: ['#5b4b62', '#6d6473'], chiyo: ['#aeb0a7', '#867d9c'],
  mei: ['#965c42', '#5f8c9b'], kisame: ['#3e5565', '#62808a'], suigetsu: ['#d1d5ce', '#7a80a0'],
  deidara: ['#d4b56d', '#8d7c5b'], onoki: ['#c1beb1', '#956b53'], kurotsuchi: ['#393638', '#a65755'],
};

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Play remains available without storage. */ }
}
function freshGame(mode = 'free', seed, date, rulesVersion = 3) {
  const game = createGame({ mode, seed, date, rulesVersion });
  return { version: 2, game, team: emptyTeam(), village: game.draws[0], cursor: 1, rerolls: 0, completed: false };
}
function initialGame() {
  const params = new URLSearchParams(location.search);
  const challenge = params.get('challenge');
  let requested = null;
  if (challenge && challenge.length < 160) {
    try {
      const mode = params.get('mode') === 'daily' || /^nindo-daily:/.test(challenge) ? 'daily' : 'free';
      const date = mode === 'daily' ? challenge.replace(/^nindo-daily:/, '') : undefined;
      const rulesVersion = params.get('rules') === '3' ? 3 : 2;
      requested = freshGame(mode, challenge, date, rulesVersion);
    } catch { /* Invalid challenge links fall back to a fresh game. */ }
  }
  const saved = readJSON(SAVE_KEY, null);
  try {
    if ([1, 2].includes(saved?.version) && ['free', 'daily'].includes(saved.game?.mode) && typeof saved.game.seed === 'string' &&
        saved.game.seed.length < 160 && Array.isArray(saved.game.draws) && saved.game.draws.length === 6 &&
        saved.game.draws.every(id => villageById[id]) && typeof saved.completed === 'boolean' &&
        Object.keys(saved.team || {}).length === 4 && ROLES.every(r => saved.team[r.id] === null ||
          (saved.version === 1 ? baseNinjaById[saved.team[r.id]] : ninjaById[saved.team[r.id]]))) {
      const canonical = createGame({ mode: saved.game.mode, seed: saved.game.seed, date: saved.game.day,
        rulesVersion: saved.game.rulesVersion ?? 2 });
      const restoredTeam = Object.fromEntries(ROLES.map(r => [r.id, saved.team[r.id] &&
        (saved.version === 1 ? `${saved.team[r.id]}@legacy` : saved.team[r.id])]));
      const picks = Object.values(restoredTeam).filter(Boolean);
      const identities = picks.map(id => ninjaById[id]?.baseCharacterId);
      const dailyValid = saved.game.mode !== 'daily' || (saved.rerolls === 0 &&
        (requested?.game.seed === saved.game.seed || saved.game.day === createGame({ mode: 'daily' }).day));
      if (saved.game.seed === canonical.seed && saved.game.missionSeed === canonical.missionSeed &&
          JSON.stringify(saved.game.draws) === JSON.stringify(canonical.draws) &&
          (saved.version === 1 || ([2, 3].includes(saved.game.rulesVersion) &&
            JSON.stringify(saved.game.eras) === JSON.stringify(canonical.eras))) &&
          (!requested || (requested.game.seed === saved.game.seed && requested.game.mode === saved.game.mode &&
            requested.game.rulesVersion === canonical.rulesVersion)) &&
          identities.every(Boolean) && new Set(identities).size === picks.length && Number.isInteger(saved.cursor) &&
          Number.isInteger(saved.rerolls) && saved.rerolls >= 0 && saved.rerolls <= 2 && dailyValid &&
          saved.cursor === Math.min(picks.length + 1, 4) + saved.rerolls &&
          saved.village === saved.game.draws[saved.cursor - 1] && (!saved.completed || picks.length === 4)) {
        // Empty older games can adopt story draws; keep all games with picks intact.
        const game = picks.length === 0 && !requested && canonical.rulesVersion === 2
          ? createGame({ mode: canonical.mode, seed: canonical.seed, date: canonical.day })
          : canonical;
        return { state: { ...saved, version: 2, game, team: restoredTeam,
          village: game.draws[saved.cursor - 1] }, restored: true };
      }
    }
  } catch { /* A malformed local save must never prevent play. */ }
  return { state: requested || freshGame(), restored: false };
}

function loadRecords() {
  const saved = readJSON(HISTORY_KEY, []);
  return Array.isArray(saved) ? saved.filter(r => r && typeof r.id === 'string' && typeof r.day === 'string' &&
    typeof r.title === 'string' && ['free', 'daily'].includes(r.mode) &&
    Number.isInteger(r.wins) && r.wins >= 0 && r.wins <= 20 && r.losses === 20 - r.wins &&
    Array.isArray(r.names) && r.names.length === 4 && r.names.every(n => typeof n === 'string')).slice(0, 12) : [];
}

function Mark({ small = false }) {
  return <svg className={small ? 'brand-mark small' : 'brand-mark'} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M31 12C17 8 9 24 18 32c9 8 22-2 15-11-4-5-12-1-9 4 1 2 4 2 5 0M16 32l-8 5 3-11M31 12l8-7-2 11" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function VillageLandscape({ village = 'leaf', hero = false }) {
  return <svg className={`landscape ${hero ? 'hero-landscape' : ''}`} viewBox="0 0 800 270" fill="none" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id={`fog-${village}-${hero}`} x1="400" y1="20" x2="400" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="currentColor" stopOpacity="0"/><stop offset="1" stopColor="currentColor" stopOpacity=".18"/></linearGradient></defs>
    <circle cx="601" cy="81" r="58" fill="currentColor" opacity=".13"/><circle cx="601" cy="81" r="76" stroke="currentColor" opacity=".09"/>
    <path d="M0 186l57-64 36 22 74-83 54 33 51-55 48 44 43-17 66 73 44-28 77 66 56-31 78 45 51-38 65 57v60H0z" fill="currentColor" opacity=".07"/>
    <path d="M0 224l115-81 77 36 74-73 86 55 55-41 88 72 62-47 93 65 61-29 89 45v44H0z" fill={`url(#fog-${village}-${hero})`}/>
    {village === 'sand' ? <g fill="currentColor" opacity=".25"><path d="M190 265v-88l28-13 28 13v88zM294 265V130l35-17 35 17v135zM408 265V85l37-18 37 18v180zM528 265V150l29-15 29 15v115z"/><path d="M0 250q180-75 340-10t460-22v52H0z"/></g> : village === 'stone' ? <g fill="currentColor" opacity=".23"><path d="M115 270l25-124 42-20 50 32 12 112M270 270l18-179 65-42 77 44 18 177M484 270l20-123 61-29 62 39 8 113M666 270l14-177 53-37 50 43 17 171"/></g> : <g stroke="currentColor" strokeWidth="2" opacity=".25">
      <path d="M232 262v-52h66v52m-77-52h88l-44-20-44 20M335 262V144h91v118m-103-118h115l-58-29-57 29M345 172h71m-71 23h71m-71 23h71M366 114V98h29v16m-34-16h39l-20-10-19 10M468 262v-80h67v80m-78-80h88l-44-24-44 24M552 262v-43h89v43m-102-43h116l-57-21-59 21M121 262v-43h67v43m-80-43h92l-46-21-46 21"/>
      <path d="M106 263h570M145 239h20m90-12h20m104-69v104m110-64h24m58 37h47"/>
      <path d="M60 270v-63m-19 21 19-42 21 42m-42 16 21-44 24 44M705 270v-80m-22 29 22-49 24 49m-51 23 27-53 29 53"/>
    </g>}
    <path d="M42 89h68m-34-5h62M670 38h73m-99 7h51M518 110h38" stroke="currentColor" opacity=".13"/>
  </svg>;
}

function Portrait({ ninja, compact = false }) {
  const characterId = ninja.baseCharacterId || ninja.id;
  const [hair, outfit] = paint[characterId] || [ninja.village === 'cloud' ? '#d6d2bd' : '#383a35', villageById[ninja.village]?.color || '#74816c'];
  const masked = ['kakashi', 'zabuza', 'kankuro'].includes(characterId);
  const longHair = ['itachi', 'neji', 'hinata', 'mei', 'jiraiya'].includes(characterId);
  return <div className={`portrait ${compact ? 'compact' : ''}`} style={{ '--portrait-accent': outfit }}>
    <span className="portrait-glyph" aria-hidden="true">{ninja.glyph || ninja.name.slice(-1)}</span>
    <svg viewBox="0 0 180 150" fill="none" aria-hidden="true">
      <ellipse cx="90" cy="145" rx="69" ry="7" fill="#000" opacity=".09"/>
      {longHair && <path d="M54 58q0-39 37-37t37 38l9 65H45z" fill={hair}/>}
      <path d="M39 150l5-30q2-13 26-18l20 12 21-12q22 4 25 18l6 30" fill={outfit}/>
      <path d="M80 89v20l10 9 11-9V89" fill="#c59f85"/>
      <ellipse cx="61" cy="73" rx="5" ry="9" fill="#d1b398"/><ellipse cx="119" cy="73" rx="5" ry="9" fill="#d1b398"/>
      <path d="M62 58q0-25 28-25t28 25v20q-2 25-28 30-25-6-28-30z" fill={ninja.village === 'cloud' ? '#ba9275' : '#dec3a3'}/>
      {['lee'].includes(characterId) ? <path d="M58 62q-4-39 32-40t32 40l-15-9-17 2-17-2z" fill={hair}/> : <path d="m56 57 3-19 12 2 1-17 14 9 8-17 9 16 17-7-1 18 12 2-9 17-17-12-14 12-13-8-10 9z" fill={hair}/>}
      <path d="M60 54h61v15H60z" fill="#3a423d"/><rect x="72" y="55" width="36" height="13" rx="3" fill="#a5ada3"/><path d="M87 59q-5 5 1 6t4-4l-4 2m5-5 3-2" stroke="#526056" strokeWidth="1.5"/>
      <path d="m71 77 11 1m17 0 11-2" stroke="#353c35" strokeWidth="2.3" strokeLinecap="round"/>
      <path d="m89 82-2 5h4" stroke="#aa8a72" strokeWidth="1.5"/>
      {masked ? <path d="m62 82 28 5 28-5q-1 20-28 26-26-6-28-26" fill={characterId === 'zabuza' ? '#b1b7a5' : '#3b4544'}/> : <path d="M83 96h14" stroke="#97775f" strokeWidth="1.5" strokeLinecap="round"/>}
      {characterId === 'naruto' && <g stroke="#a27960" strokeWidth="1"><path d="m66 84 10 2m-10 3 10 1m29-4 9-3m-9 7 9-2"/></g>}
      <path d="m70 103 20 15-11 20-17-31m49-4-21 15 11 20 18-30" fill="#101914" opacity=".3"/>
      <path d="M90 119v31" stroke="#101914" strokeWidth="2" opacity=".25"/>
    </svg>
  </div>;
}

function Stats({ ninja }) {
  return <div className="stats-grid">{STAT_KEYS.map(key => <div className="stat" key={key}><div><span>{STAT_LABELS[key]}</span><strong>{ninja.stats[key]}</strong></div><div className="stat-track"><span style={{ width: `${ninja.stats[key]}%` }}/></div></div>)}</div>;
}

function DrawReel({ type, entries, selectedId, rolling }) {
  const label = type === 'village' ? '忍村' : '时期';
  const selected = entries.find(entry => entry.id === selectedId);
  const stop = entries.length * 4 + entries.findIndex(entry => entry.id === selectedId);
  const sequence = Array.from({ length: stop + 2 }, (_, index) => entries[index % entries.length]);
  return <div className={`draw-slot draw-slot-${type} ${rolling ? 'is-spinning' : ''}`} role="group" aria-label={rolling ? `${label}抽签中` : `${label}：${selected.name}`} aria-busy={rolling}>
    <div className="draw-slot-label"><strong>{label}</strong><span>{type === 'village' ? 'VILLAGE' : 'ERA'}</span></div>
    <div className="draw-reel-window" aria-hidden="true">
      <div className="draw-reel-track" style={{ '--draw-stop': stop }}>
        {sequence.map((entry, index) => <div className="draw-reel-value" key={index}>{entry.shortName || entry.name}</div>)}
      </div>
      <span className="draw-reel-glint"/>
    </div>
  </div>;
}

function NinjaComparison({ ninjas, rolling, onSelect, query, onClear }) {
  const scrollRef = useRef(null);
  const [sortKey, setSortKey] = useState('');
  const ordered = useMemo(() => sortKey ? [...ninjas].sort((a, b) => b.stats[sortKey] - a.stats[sortKey]) : ninjas, [ninjas, sortKey]);
  const maxima = Object.fromEntries(STAT_KEYS.map(key => [key, Math.max(...ninjas.map(n => n.stats[key]))]));
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = 0; }, [query, sortKey]);
  const move = direction => scrollRef.current?.scrollBy({ left: direction * 400, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const revealColumn = event => {
    const scroller = scrollRef.current;
    const cell = event.currentTarget.closest('th');
    const pinnedWidth = scroller.querySelector('.comparison-label').getBoundingClientRect().width;
    const viewport = scroller.getBoundingClientRect();
    const bounds = cell.getBoundingClientRect();
    if (bounds.left < viewport.left + pinnedWidth) scroller.scrollLeft -= viewport.left + pinnedWidth - bounds.left;
    else if (bounds.right > viewport.right) scroller.scrollLeft += bounds.right - viewport.right;
  };
  return <section className={`comparison-panel ${rolling ? 'is-rolling' : ''}`} aria-label="本轮忍者八维对比" aria-busy={rolling}>
    <div className="comparison-tools"><span>本轮候选 · <b>亮色为本次列表最高值</b></span><div><span>左右滑动对比</span><button className="icon-button" aria-label="向左查看忍者" onClick={() => move(-1)}><ChevronLeft size={16}/></button><button className="icon-button" aria-label="向右查看忍者" onClick={() => move(1)}><ChevronRight size={16}/></button></div></div>
    {ninjas.length ? <div className="comparison-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="忍者对比表，可左右滚动">
      <table className="comparison-table" style={{ '--candidate-count': ordered.length }}>
        <caption className="sr-only">本轮 {ninjas.length} 位候选忍者。点击忍者选择职责；点击属性名按该项从高到低排序。</caption>
        <colgroup><col style={{ width: 76 }}/>{ordered.map(ninja => <col key={ninja.id}/>)}</colgroup>
        <thead><tr><th className="comparison-label" scope="col"><span>忍者档案</span><small>点击忍者<br/>选择位置</small></th>{ordered.map(ninja => <th scope="col" key={ninja.id}><button className="compare-ninja" onClick={() => onSelect(ninja)} onFocus={revealColumn} disabled={rolling} aria-label={`选择${ninja.name}（${eraById[ninja.eraId].shortName}），分配位置`}><Portrait ninja={ninja} compact/><strong>{ninja.name}</strong><small title={`${ninja.version}${ninja.rogue ? " · 离村忍者" : ""}`}>{ninja.version.split('·').slice(1).join('·') || ninja.version}</small><span>选择忍者<ArrowRight size={12}/></span></button></th>)}</tr></thead>
        <tbody>{STAT_KEYS.map(key => <tr key={key}><th className="comparison-label" scope="row"><button className={sortKey === key ? 'sorted' : ''} aria-label={`按${STAT_LABELS[key]}从高到低排序`} aria-pressed={sortKey === key} onClick={() => setSortKey(current => current === key ? '' : key)}>{STAT_LABELS[key]}<span>{sortKey === key ? '↓' : '↕'}</span></button></th>{ordered.map(ninja => <td className={ninja.stats[key] === maxima[key] ? 'stat-maximum' : ''} key={ninja.id}><strong>{ninja.stats[key]}</strong><span className="compare-stat-bar"><i style={{ width: `${ninja.stats[key]}%` }}/></span></td>)}</tr>)}
          <tr className="comparison-traits"><th className="comparison-label" scope="row">特长</th>{ordered.map(ninja => <td key={ninja.id}><div>{ninja.tags.map(tag => <span key={tag}>{traitLabels[tag] || tag}</span>)}</div></td>)}</tr>
        </tbody>
      </table>
    </div> : <div className="empty-search"><Search size={25}/><p>没有找到“{query}”</p><button className="text-button" onClick={onClear}>查看本轮全部忍者</button></div>}
  </section>;
}

function Modal({ title, eyebrow, children, onClose, wide = false, focusSelector }) {
  const ref = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    ref.current?.showModal();
    if (focusSelector) ref.current?.querySelector(focusSelector)?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus?.();
      else document.querySelector('.comparison-scroll, .launch-button')?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-label={title}>
    <div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20}/></button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}

function App() {
  const [initial] = useState(initialGame);
  const [state, setState] = useState(initial.state);
  const [search, setSearch] = useState('');
  const [selectedNinja, setSelectedNinja] = useState(null);
  const [rolling, setRolling] = useState(() => !initial.restored && Object.values(state.team).filter(Boolean).length < 4);
  const [rollKey, setRollKey] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [modal, setModal] = useState(null);
  const [nextMode, setNextMode] = useState(null);
  const [archiveVillage, setArchiveVillage] = useState('leaf');
  const [archiveEra, setArchiveEra] = useState('legacy');
  const [archiveNinja, setArchiveNinja] = useState(null);
  const [toast, setToast] = useState('');
  const [records, setRecords] = useState(loadRecords);
  const timeoutRef = useRef(null);
  const team = useMemo(() => Object.fromEntries(ROLES.map(r => [r.id, ninjaById[state.team[r.id]] || null])), [state.team]);
  const count = Object.values(team).filter(Boolean).length;
  const complete = count === 4;
  const village = villageById[state.village];
  const era = eraById[state.game.eras[state.cursor - 1]];
  const candidates = useMemo(() => drawCandidates(state.village, team, state.game.seed, state.cursor - 1, era.id), [state.village, team, state.game.seed, state.cursor, era.id]);
  const missionPlan = useMemo(() => createMissionPlan(state.game.missionSeed), [state.game.missionSeed]);
  const missionCounts = Object.fromEntries(Object.keys(missionFocus).map(type => [type, missionPlan.filter(mission => mission.type === type).length]));
  const filtered = candidates.filter(n => `${n.name}${n.alias}${n.specialty}`.includes(search.trim()));
  const analysis = useMemo(() => evaluateTeam(team), [team]);
  const result = useMemo(() => complete && state.completed ? simulateMissions(team, state.game.missionSeed) : null, [complete, state.completed, team, state.game.missionSeed]);
  const daily = state.game.mode === 'daily';

  useEffect(() => writeJSON(SAVE_KEY, state), [state]);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => setRolling(false), DRAW_DURATION_MS);
    return () => clearTimeout(timer);
  }, [rolling, rollKey]);

  const startRoll = () => { setRollKey(key => key + 1); setRolling(true); };

  const reset = (mode = state.game.mode) => {
    clearTimeout(timeoutRef.current);
    setState(freshGame(mode)); setSearch(''); setSelectedNinja(null); startRoll(); setResolving(false); setModal(null);
    if (location.search) {
      const params = new URLSearchParams(location.search);
      ['challenge', 'mode', 'rules'].forEach(key => params.delete(key));
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
    }
  };
  const requestReset = mode => {
    if (count > 0 && !state.completed) { setNextMode(mode); setModal('restart'); }
    else reset(mode);
  };
  const reroll = () => {
    if (daily || rolling || complete || state.rerolls >= 2) return;
    startRoll(); setSearch(''); setSelectedNinja(null); setModal(null);
    setState(prev => ({ ...prev, village: prev.game.draws[prev.cursor], cursor: prev.cursor + 1, rerolls: prev.rerolls + 1 }));
  };
  const selectNinja = ninja => {
    if (rolling || complete || !candidates.some(n => n.id === ninja.id)) return;
    setSelectedNinja(ninja); setModal('recruit');
  };
  const pick = (ninja, roleId) => {
    if (!ninja || !ROLES.some(r => r.id === roleId) || team[roleId] || rolling || complete || !candidates.some(n => n.id === ninja.id)) return;
    const newTeam = { ...state.team, [roleId]: ninja.id };
    const remaining = ROLES.find(r => !newTeam[r.id]);
    setSearch(''); setSelectedNinja(null); setModal(null);
    if (remaining) {
      startRoll();
      setState(prev => ({ ...prev, team: newTeam, village: prev.game.draws[prev.cursor], cursor: prev.cursor + 1 }));
    } else { setState(prev => ({ ...prev, team: newTeam })); setToast('四人集结完毕，小队可以出发了。'); }
  };
  const run = () => {
    if (!complete || resolving) return;
    setResolving(true);
    timeoutRef.current = setTimeout(() => {
      const output = simulateMissions(team, state.game.missionSeed);
      const record = { id: `${state.game.seed}:${Object.values(state.team).join(':')}`, day: new Date().toLocaleDateString('zh-CN'), wins: output.wins, losses: output.losses, title: output.title, names: ROLES.map(r => `${team[r.id].name}（${eraById[team[r.id].eraId].shortName}）`), mode: state.game.mode };
      const updated = [record, ...records.filter(r => r.id !== record.id)].slice(0, 12);
      writeJSON(HISTORY_KEY, updated); setRecords(updated);
      setState(prev => ({ ...prev, completed: true })); setResolving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1400);
  };
  const copy = async (text, success) => {
    try {
      await navigator.clipboard.writeText(text); setToast(success);
    } catch {
      const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select();
      try { if (!document.execCommand('copy')) throw new Error('copy'); setToast(success); } catch { setToast('复制暂不可用，请从地址栏复制挑战链接。'); }
      input.remove();
    }
  };
  const challengeURL = `${location.origin}${location.pathname}?demo=nindo&challenge=${encodeURIComponent(state.game.seed)}${daily ? '&mode=daily' : ''}&rules=${state.game.rulesVersion}`;
  const share = () => copy(`忍道 NINDO · S级任务挑战\n${result.wins}次成功 / ${result.losses}次失败 · ${result.title}\n${ROLES.map(r => `${r.name}：${team[r.id].name}（${eraById[team[r.id].eraId].shortName}）`).join(' / ')}\n相同忍村＋时期签，你能带出更强的小队吗？\n${challengeURL}`, '战报和同签挑战链接已复制。');

  return <>
    <header className="site-header"><a className="brand" href="./" onClick={e => e.preventDefault()} aria-label="忍道首页"><Mark/><span>忍道 <b>NINDO</b></span><span className="brand-divider"/><small>SHINOBI DRAFT</small></a>
      <nav aria-label="主导航"><button className="nav-button active" onClick={() => { setModal(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>小队集结</button><button className="nav-button" onClick={() => setModal('archive')}>忍者档案 <ArrowUpRight size={13}/></button><button className="nav-button" onClick={() => setModal('rules')}>玩法说明</button></nav>
      <button className="history-button" aria-label="任务记录" onClick={() => setModal('history')}><History size={16}/><span>任务记录</span></button>
    </header>

    <main className="shell">
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="orange-line"/> FOUR SHINOBI. ONE NINJA WAY.</div><h1>集结你的小队，<br className="mobile-break"/><span>改写任务结局。</span></h1><p>抽取忍村与时期 · 招募忍者 · 让每个人，站在最适合的位置。</p></div><div className="hero-art"><VillageLandscape hero/><div className="hero-stamp"><span>极秘</span><b>S</b><small>RANK MISSION</small></div><span className="hero-kanji">忍</span></div><div className="hero-coordinate">火の意志を、次の世代へ。<span>忍者联合 · 任务集结令 001</span></div></section>

      <div className="game-toolbar"><div className="mode-tabs" aria-label="游戏模式"><button className={!daily ? 'selected' : ''} onClick={() => { if (daily) requestReset('free'); }}><Dices size={15}/>自由组队</button><button className={daily ? 'selected' : ''} onClick={() => { if (!daily) requestReset('daily'); }}><Target size={15}/>每日试炼<span className="tiny-dot"/></button></div><div className="toolbar-hint">{state.game.rulesVersion === 2 ? <><Info size={14}/>本局保留原签 · 新一局体验剧情时期</> : daily ? <><Target size={14}/>今日同村、同时期、同任务</> : <><Wind size={14}/>剧情时期随机 · 连续不重复</>}</div><button className="text-button new-game" onClick={() => requestReset(state.game.mode)}><RotateCcw size={14}/><span>{daily ? '重试今日挑战' : '随机新一局'}</span></button></div>

      {result ? <section className="result-layout" aria-label="任务战报">
        <div className="result-main"><div className="result-heading"><div><span className="eyebrow">MISSION REPORT / 任务完结</span><h2>每一场胜利，都有你的选择。</h2></div><span className="completion-seal">任务<br/>完结</span></div>
          <div className="score-display"><div><strong>{result.wins.toString().padStart(2, '0')}</strong><span><Check size={15}/>成功</span></div><span className="score-separator">—</span><div className="loss-score"><strong>{result.losses.toString().padStart(2, '0')}</strong><span><X size={15}/>失败</span></div><div className="score-title"><Trophy size={25}/><h3>{result.title}</h3><p>20 次 S 级任务 · {daily ? '每日试炼' : '自由组队'}</p></div></div>
          <div className="result-actions"><button className="primary-button" onClick={share}><Copy size={16}/>复制战报，挑战好友<ArrowUpRight size={17}/></button><button className="secondary-button" onClick={() => reset()}><RotateCcw size={15}/>再组一队</button></div>
          <div className="mission-list-header"><h3><span className="section-number">01</span>任务纪要</h3><span>同签 · 同阵容 · 同结果</span></div>
          <div className="missions">{result.missions.map((m, i) => <details key={m.id} className={`mission ${m.success ? 'success' : 'failure'}`}><summary><span className="mission-index">{String(i + 1).padStart(2, '0')}</span><span className="mission-type">{m.type}</span><span className="mission-name">{m.name}</span><span className="mission-outcome">{m.success ? <Check size={13}/> : <X size={13}/>}{m.success ? '完成' : '失利'}</span><ChevronRight size={14}/></summary><div className="mission-detail"><p>{m.reason}</p><span>小队适配 {m.score.toFixed(1)} · 任务难度 {m.difficulty} · 临场波动 {m.luck >= 0 ? '+' : ''}{m.luck.toFixed(1)}</span></div></details>)}</div>
        </div>
        <aside className="result-aside"><Squad team={team} analysis={analysis} complete/>
          <div className="analysis-card"><span className="eyebrow">TEAM DEBRIEF</span><h3>小队复盘</h3>{analysis.strengths?.map((s, i) => <p key={i}><Check size={15}/>{s}</p>)}{analysis.weaknesses?.map((s, i) => <p className="weakness" key={i}><Info size={15}/>{s}</p>)}<button className="text-button" onClick={() => setModal('rules')}>了解结算规则<ArrowUpRight size={14}/></button></div>
        </aside>
      </section> : <section className="draft-layout" aria-label="组建四人小队">
        <div className="draft-main">
          <div className="section-header"><h2><span className="section-number">01</span>{complete ? '小队已集结' : '忍村 × 时期签已揭晓'}</h2><span className="round-label">ROUND <b>{Math.min(count + 1, 4)}</b> / 04</span></div>
          {complete ? <div className="village-card complete" style={{ '--village-color': village.color }}>
            <VillageLandscape village={state.village}/><div className="village-emblem"><Check size={38}/></div>
            <div className="village-copy"><span className="eyebrow">ALL FOUR SHINOBI ASSEMBLED</span><h3>四人同行，任务将启。</h3><p>检查职责分配，然后出发挑战 20 次 S 级任务。</p></div>
          </div> : <div className="draw-pair" aria-label="忍村与时期抽签" style={{ '--draw-duration': `${DRAW_DURATION_MS}ms` }}>
            <DrawReel key={`village-${rollKey}`} type="village" entries={VILLAGES} selectedId={state.village} rolling={rolling}/>
            <DrawReel key={`era-${rollKey}`} type="era" entries={state.game.rulesVersion === 2 ? ERAS : ERAS.filter(entry => entry.id !== 'legacy')} selectedId={era.id} rolling={rolling}/>
            {rolling && <span className="sr-only" role="status">正在快速抽取忍村与时期</span>}
          </div>}

          {complete ? <div className="ready-panel"><div className="ready-symbol"><Swords size={35}/></div><span className="eyebrow">YOUR TEAM IS READY</span><h2>四个人的配合，<br/>决定每一场结局。</h2><p>潜入、追踪、强袭、护送。<br/>二十道任务，检验小队的每一面。</p><button className="primary-button launch-button" onClick={run} disabled={resolving}>{resolving ? <><LoaderCircle className="spin" size={18}/>正在执行 S 级任务…</> : <><Swords size={18}/>出发，执行任务<ArrowRight size={18}/></>}</button><span className="ready-note">任务无死亡惩罚 · 结果按同一任务种子计算</span></div> : <>
            <div className="draft-instruction"><div className="draw-guidance"><h3>先选忍者，再选编入位置。</h3><p>对比下方 6 位忍者，点击后选择职责。</p></div><button className="paired-reroll" onClick={reroll} disabled={rolling || daily || state.rerolls >= 2} title={daily ? '每日试炼不提供重抽，每人抽签相同' : '同时重抽忍村与时期；新局不会连续抽到相同时期'}><RotateCcw size={15}/><span>{daily ? '每日固定签' : rolling ? '抽签中…' : '重抽忍村与时期'}</span><b>{daily ? '—' : `${2 - state.rerolls}/2`}</b></button></div>
            <div className="roster-toolbar"><div><h3>可招募忍者 <span>{candidates.length}</span></h3><p>当前时期随机 6 位 · 点击属性名可排序</p></div><label className="search-field"><Search size={15}/><input aria-label="搜索本轮候选忍者" placeholder="搜索忍者" value={search} onChange={e => setSearch(e.target.value)} disabled={rolling}/>{search && <button aria-label="清空搜索" onClick={() => setSearch('')}><X size={13}/></button>}</label></div>
            <NinjaComparison key={state.cursor} ninjas={filtered} rolling={rolling} onSelect={selectNinja} query={search} onClear={() => setSearch('')}/>
          </>}
          <div className="data-note"><Info size={13}/><span>属性参考原作特长与公式书八维，数值为游戏设计。<button onClick={() => setModal('sources')}>设定与来源<ArrowUpRight size={11}/></button></span></div>
        </div>

        <aside className="squad-sidebar"><Squad team={team} analysis={analysis} complete={complete}/>
          <div className="mission-brief"><div className="brief-title"><span className="rank-badge">S</span><span>本次委托<small>MISSION BRIEF</small></span></div><div className="brief-count"><strong>20</strong><span>次高危任务<small>成功 + 失败 = 20</small></span></div><div className="mission-types" aria-label="本局随机任务分布">{Object.entries(missionCounts).map(([type, amount]) => <span key={type} title={missionFocus[type]}>{type} × {amount}</span>)}</div><div className="brief-divider"/><p>四种任务，四种考验。<br/>队长的决策、侦察的情报、突破的战力与支援的保障，缺一不可。</p><button className="text-button" onClick={() => setModal('rules')}>任务如何结算<ArrowUpRight size={14}/></button></div>
          <div className="sidebar-quote"><span>“</span><p>在忍者的世界里，<br/>不珍惜同伴的人，<br/>连废物都不如。</p><small>— 旗木卡卡西</small></div>
        </aside>
      </section>}
      <footer className="site-footer"><span><Mark small/>忍道 NINDO <i>·</i> 每一种选择，都有你的忍道。</span><button onClick={() => setModal('sources')}>同人玩法原型 / 设定说明<ArrowUpRight size={12}/></button></footer>
    </main>

    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}

    {modal === 'recruit' && selectedNinja && <Modal title={`为${selectedNinja.name}选择编入位置`} eyebrow="ASSIGN A ROLE / 忍者招募" onClose={() => { setModal(null); setSelectedNinja(null); }} wide focusSelector=".assignment-option:not(:disabled)">
      <div className="assignment-profile"><Portrait ninja={selectedNinja} compact/><div><h3>{selectedNinja.name}<span>{selectedNinja.alias}</span></h3><p>{villageById[selectedNinja.village].name} · {selectedNinja.version}{selectedNinja.rogue ? ' · 离村忍者' : ''}</p></div></div>
      <p className="assignment-hint">点击空缺职责即确认编入，本局确认后不可替换。</p>
      <div className="assignment-grid">{ROLES.map(r => {
        const Icon = roleIcons[r.id];
        const occupied = team[r.id];
        const score = Math.round(roleScore(selectedNinja, r.id));
        return <button key={r.id} className={`assignment-option ${occupied ? 'occupied' : ''}`} disabled={!!occupied || rolling} onClick={() => pick(selectedNinja, r.id)} aria-label={occupied ? `${r.name}已由${occupied.name}担任` : `编入${r.name}，适配${score}`}>
          <div className="assignment-role"><Icon size={24}/><strong>{r.name}</strong><span>{score}<small>适配</small></span></div>
          <p>{r.description}</p><div className="assignment-cta">{occupied ? <><Check size={14}/>已编入{occupied.name}</> : <>编入{r.name}<ArrowRight size={16}/></>}</div>
        </button>;
      })}</div>
      <button className="assignment-back text-button" onClick={() => { setModal(null); setSelectedNinja(null); }}><ChevronLeft size={15}/>返回对比，继续选人</button>
    </Modal>}

    {modal === 'rules' && <Modal title="四人同行，如何赢下任务？" eyebrow="FIELD MANUAL / 玩法说明" onClose={() => setModal(null)}><div className="rule-steps"><div><b>01</b><section><h3>抽取忍村 × 剧情时期</h3><p>新局从中忍考试、晓组织对抗、五影会谈、第四次忍界大战中随机抽取时期，连续两签不会重复，再从该时期已开放忍村中抽签。四种时期长期概率相同，每局出现次数不固定。历代忍者只保留在档案室与已开始的旧局。每轮随机抽出 6 位候选，同一人物即使时期不同也不能重复入队。</p></section></div><div><b>02</b><section><h3>让合适的人，做合适的事</h3><p>四人分别担任队长、侦察、突破、支援。本轮 6 位候选忍者横向并列，八维能力逐行对齐。点击忍者后，在弹窗中选择空缺职责，确认后本局无法替换。自由模式每局可重抽两次，每日试炼固定抽签。</p></section></div><div><b>03</b><section><h3>出发，挑战 20 次 S 级任务</h3><p>共20次任务，每次从潜入、追踪、强袭、护送中等概率随机抽取，四类数量不固定，难度由低到高。右侧委托展示本局实际任务分布，可据此安排阵容。每次任务只记成功或失败，不存在伤亡或养成损耗。</p></section></div></div><div className="formula-note"><h3>为什么高总分不一定更强？</h3><p>每个职责对八维属性有不同权重。例如队长更看重智谋，突破更看重忍体术与力量。任务分结合四个职责，并检查关键位短板，再加少量配合加成。潜入侧重侦察（40%），追踪侧重队长和侦察（各35%），强袭侧重突破（45%），护送侧重支援（40%）。</p><div>职责适配 + 任务配合 + 临场发挥 → 任务结局</div><p>临场发挥只在 ±4 分以内波动。同一组忍村与时期签、同一版本阵容、同一职责的结果固定；重复结算不会刷出新运气。</p></div><button className="primary-button full-width" onClick={() => setModal(null)}>明白了，开始集结<ArrowRight size={16}/></button></Modal>}

    {modal === 'sources' && <Modal title="设定与数值来源" eyebrow="ARCHIVE NOTES / 数据口径" onClose={() => setModal(null)}><div className="source-content"><h3>八维来自公式书体系，数值属于本游戏</h3><p>使用忍术、体术、幻术、智谋、力量、速度、查克拉、结印八个能力方向，参考《NARUTO－ナルト－秘伝・者の書》等角色资料的八维框架。所有 0–100 属性、职责权重、协同和任务结算均为游戏估值，不是官方战力排名或公式书原数。</p><h3>同一人物，按剧情时期区分能力</h3><p>每份时期档案单独设置八维数值、特长和形态。例如中忍考试鸣人与大战九尾查克拉鸣人的能力不同；同一人物的不同版本不能重复入队。历代忍者池保留原常规档案；战争池的秽土复刻会明确标注，不计不死与自动恢复。排除六道、轮回眼佐助、双神威卡卡西、十尾与最终八门等极端形态。</p><h3>时期池为什么不是每村都有？</h3><p>只开放资料和人数足够的忍村与时期组合，每池至少 9 名不同人物，确保连续四轮也能抽出 6 位候选。中忍考试、晓组织对抗、五影会谈目前只有木叶满足人数要求，大战覆盖五村。新局先抽时期再匹配合法忍村，因此木叶更常出现，五村不是等概率。历代忍者可在档案室查看，不加入新局抽签。</p><h3>按出身忍村归档</h3><p>历史集结允许不同年代与阵营同行。离村角色仍归入出身忍村，并在卡片标注；鬼灯水月按雾隐出身收录。忍村归档不代表角色在剧情中始终效忠该村。</p><div className="source-links"><a href="https://naruto-official.com/en/books" target="_blank" rel="noreferrer">NARUTO 官方 · 角色资料书目录<ArrowUpRight size={15}/></a><a href="https://naruto-official.com/en/anime/naruto2" target="_blank" rel="noreferrer">NARUTO 官方 · 疾风传设定<ArrowUpRight size={15}/></a></div><p className="source-footnote">剧情池按篇章内的代表状态收录，不是同一集的全员合影；已退场人物不混入之后的常规池。时期变化与数值为本游戏估算，官方没有覆盖全部人物及阶段的统一 0–100 属性表。</p></div></Modal>}

    {modal === 'archive' && <Modal title="忍者档案室" eyebrow={`SHINOBI ARCHIVES / ${NINJAS.length} 位忍者 · ${NINJA_VERSIONS.length} 份时期档案`} onClose={() => { setModal(null); setArchiveNinja(null); }} wide>
      <div className="archive-tabs" aria-label="档案忍村">{VILLAGES.map(v => <button className={archiveVillage === v.id ? 'selected' : ''} key={v.id} onClick={() => {
        setArchiveVillage(v.id); setArchiveNinja(null);
        if (!DRAFT_POOLS.some(pool => pool.villageId === v.id && pool.eraId === archiveEra)) setArchiveEra('legacy');
      }}>{v.name}</button>)}</div>
      <div className="archive-era-tabs" aria-label="档案剧情时期">{ERAS.map(entry => {
        const available = DRAFT_POOLS.some(pool => pool.villageId === archiveVillage && pool.eraId === entry.id);
        return <button key={entry.id} disabled={!available} title={available ? entry.description : '该村在此时期的可收录人数不足，暂未开放'} className={archiveEra === entry.id ? 'selected' : ''} onClick={() => { setArchiveEra(entry.id); setArchiveNinja(null); }}>{entry.shortName}</button>;
      })}</div>
      <p className="archive-era-description">{eraById[archiveEra].description}<span>{NINJA_VERSIONS.filter(n => n.village === archiveVillage && n.eraId === archiveEra).length} 份档案</span></p>
      {archiveNinja ? <div className="archive-detail"><button className="text-button" onClick={() => setArchiveNinja(null)}><ChevronLeft size={15}/>返回忍者列表</button><div className="archive-profile"><Portrait ninja={archiveNinja}/><div><span className="eyebrow">{archiveNinja.version}</span><h3>{archiveNinja.name}</h3><p>{archiveNinja.specialty}</p>{archiveNinja.rogue && <small>出身{villageById[archiveNinja.village].name} · 离村忍者</small>}</div></div><Stats ninja={archiveNinja}/><div className="archive-role-scores">{ROLES.map(r => <div key={r.id}><span>{r.name}适配</span><strong>{Math.round(roleScore(archiveNinja, r.id))}</strong></div>)}</div></div> : <div className="archive-list">{NINJA_VERSIONS.filter(n => n.village === archiveVillage && n.eraId === archiveEra).map(n => <button key={n.id} onClick={() => setArchiveNinja(n)}><Portrait ninja={n} compact/><span><strong>{n.name}</strong><small title={n.version}>{n.version}</small></span><ChevronRight size={16}/></button>)}</div>}
      <p className="archive-note">按篇章代表状态收录；八维能力及适配分为游戏设计数值。</p>
    </Modal>}

    {modal === 'history' && <Modal title="任务记录" eyebrow="PAST EXPEDITIONS / 最近 12 次" onClose={() => setModal(null)}>{records.length ? <div className="history-list">{records.map(r => <article key={r.id}><div><span>{r.day} · {r.mode === 'daily' ? '每日试炼' : '自由组队'}</span><h3>{r.title}</h3><p>{r.names.join(' / ')}</p></div><strong>{r.wins}<small> — {r.losses}</small></strong></article>)}<p className="archive-note">记录保存在当前浏览器中。</p></div> : <div className="empty-history"><History size={35}/><h3>第一份战报，等你书写。</h3><p>完成四人集结并执行任务后，战报将保存在这里。</p><button className="primary-button" onClick={() => setModal(null)}>去集结小队<ArrowRight size={16}/></button></div>}</Modal>}

    {modal === 'restart' && <Modal title="开始一次新的集结？" eyebrow="NEW EXPEDITION" onClose={() => setModal(null)}><p className="restart-copy">本局已招募 {count} 位忍者。开始新局将清除本局的选人进度，已完成的战报会保留。</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setModal(null)}>继续本局</button><button className="primary-button" onClick={() => reset(nextMode || state.game.mode)}>开始新局<ArrowRight size={16}/></button></div></Modal>}
  </>;
}

function Squad({ team, analysis, complete }) {
  const count = Object.values(team).filter(Boolean).length;
  return <div className="squad-card"><div className="squad-header"><div><span className="eyebrow">YOUR SQUAD</span><h2>四人小队<span>{count}<i>/ 4</i></span></h2></div><Users size={21}/></div><div className="squad-progress">{ROLES.map(r => <span className={team[r.id] ? 'filled' : ''} key={r.id}/>)}</div><div className="squad-slots">{ROLES.map((r, index) => { const ninja = team[r.id]; const Icon = roleIcons[r.id]; return <div className={`squad-slot ${ninja ? 'filled' : ''}`} key={r.id} role="group" aria-label={ninja ? `${r.name}：${ninja.name}（${eraById[ninja.eraId].shortName}）` : `${r.name}待分配`}><div className="slot-number">{ninja ? <Portrait ninja={ninja} compact/> : <Icon size={21}/>}</div><div className="slot-info"><span>{r.name}<small>0{index + 1}</small></span><strong>{ninja ? ninja.name : '等待忍者加入'}</strong><p className={ninja ? "slot-era" : ""} title={ninja?.version}>{ninja ? eraById[ninja.eraId].shortName : r.description}</p></div><div className="slot-indicator">{ninja ? <><strong>{Math.round(roleScore(ninja, r.id))}</strong><small>适配</small></> : <span>—</span>}</div></div>; })}</div><div className="squad-link"><span><Sparkles size={14}/>小队配合</span><strong>{count ? `+${analysis.synergy.toFixed(1)}` : '待集结'}</strong></div><div className="bond-list">{analysis.bonds?.length ? analysis.bonds.map((b, i) => <span key={i} title={b.description}>{b.name}</span>) : <p>{complete ? '不同来路，也能成为可靠的同伴。' : '集结同伴，建立属于你的小队配合。'}</p>}</div></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
