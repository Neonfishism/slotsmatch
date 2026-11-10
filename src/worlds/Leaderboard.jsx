import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Crown, LoaderCircle, RefreshCw, Trophy, WifiOff } from 'lucide-react';
import { fetchLeaderboard } from './leaderboard.js';
import './leaderboard.css';

function LeaderboardRow({ entry, own = false }) {
  return <tr className={own ? 'lb-own-row' : ''}>
    <td className={`lb-rank ${entry.rank <= 3 ? 'lb-podium' : ''}`}><span>{entry.rank === 1 ? <Crown size={17} aria-label="榜首"/> : String(entry.rank).padStart(2, '0')}</span></td>
    <th scope="row" className="lb-team"><strong>{entry.teamName}{own && <span className="lb-you">本次战队</span>}</strong><small>{entry.regionId} · 2026 世界赛</small></th>
    <td className={`lb-placement ${entry.placementRank === 1 ? 'lb-champion' : ''}`}>{entry.placement}</td>
    <td className="lb-record"><b>{entry.wins}</b><span> / </span>{entry.losses}</td>
    <td className="lb-rating">{Number(entry.teamRating).toFixed(1)}</td>
  </tr>;
}

export default function Leaderboard({ entryId, refreshKey = 0 }) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ entries: [], total: 0, ownEntry: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchLeaderboard({ entryId, signal: controller.signal }).then(next => {
      if (!controller.signal.aborted) setData(next);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message || '排行榜暂时无法更新，请稍后重试。');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [entryId, refreshKey, revision]);

  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') setRevision(value => value + 1); }, 60000);
    return () => clearInterval(timer);
  }, []);

  const entries = data.entries || [];
  const outsideTop = entryId && data.ownEntry?.id === entryId && !entries.some(entry => entry.id === data.ownEntry.id);

  return <section className="lb-panel" id="leaderboard" aria-label="全球战队排行榜" aria-busy={loading}>
    <header className="lb-heading"><div><span className="eyebrow">2026 WORLDS / GLOBAL RANKING</span><h2><Trophy size={18}/>全球战队排行榜</h2></div><button className="lb-refresh" onClick={() => setRevision(value => value + 1)} disabled={loading} aria-label="刷新排行榜">{loading ? <LoaderCircle size={14} className="spin"/> : <RefreshCw size={14}/>}<span>刷新榜单</span></button></header>
    <div className="lb-meta"><span>玩家战队 · TOP 10</span><span>{data.total ? `${data.total} 支战队已出征` : '共同争夺世界之巅'}</span></div>
    {error && <div className="lb-error" role="status"><WifiOff size={16}/><p>{error}{entries.length > 0 && <small>以下为上次成功获取的榜单。</small>}</p><button onClick={() => setRevision(value => value + 1)}>重试<ArrowUpRight size={12}/></button></div>}
    {entries.length > 0 ? <div className="lb-table-wrap"><table className="lb-table"><caption className="sr-only">2026 世界赛玩家战队前十名，依次按最终名次、胜场、负场和战力排序。</caption><thead><tr><th scope="col">排名</th><th scope="col">战队</th><th scope="col">世界赛名次</th><th scope="col">胜 / 负</th><th scope="col" className="lb-rating">战队战力</th></tr></thead><tbody>{entries.map(entry => <LeaderboardRow key={entry.id} entry={entry} own={entry.id === entryId}/>)}</tbody>{outsideTop && <tbody className="lb-own-section"><tr className="lb-divider"><td colSpan={5}>你的本次成绩</td></tr><LeaderboardRow entry={data.ownEntry} own/></tbody>}</table></div>
      : loading ? <div className="lb-empty" role="status"><LoaderCircle size={24} className="spin"/><p>正在获取玩家战队成绩…</p></div>
        : !error && <div className="lb-empty"><Trophy size={29}/><h3>榜首席位，等你来。</h3><p>完成一次世界赛出征，让你的战队登上排行榜。</p></div>}
    <footer className="lb-footnote"><span>按最终名次 → 胜场 → 负场 → 战队战力排序</span><span>{data.updatedAt ? `更新于 ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(data.updatedAt))}` : '所有玩家共享 · 每分钟更新'}</span></footer>
  </section>;
}
