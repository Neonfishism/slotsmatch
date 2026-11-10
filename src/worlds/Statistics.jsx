import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, ClipboardList, Info, LoaderCircle, Monitor, RefreshCw, Trophy, WifiOff } from 'lucide-react';
import { fetchStatistics } from './leaderboard.js';
import './worlds.css';
import './statistics.css';

const countFormat = new Intl.NumberFormat('zh-CN');
const timeFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const timeLabel = value => value && Number.isFinite(new Date(value).getTime()) ? timeFormat.format(new Date(value)) : '—';

function Metric({ label, value, note, primary = false }) {
  return <article className={`stats-metric ${primary ? 'stats-metric-primary' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export default function Statistics() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchStatistics({ page, pageSize: 25, signal: controller.signal }).then(next => {
      if (!controller.signal.aborted) {
        setData(next);
        if (next.pagination?.totalPages && page > next.pagination.totalPages) setPage(next.pagination.totalPages);
      }
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message || '统计数据暂时无法获取，请稍后重试。');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [page, revision]);

  const totals = data?.totals;
  const players = data?.pagination?.page === page ? data.players || [] : [];
  const number = value => totals ? countFormat.format(value || 0) : '—';
  const totalPages = Math.max(data?.pagination?.totalPages || 1, 1);
  const changePage = next => { setPage(next); };

  return <>
    <header className="w-header stats-site-header"><a href="./" className="w-brand" aria-label="Worlds Draft 首页"><span className="brand-icon"><Trophy size={22}/></span><span>WORLDS<span className="brand-light">DRAFT</span><small>世界赛 · 战队选秀</small></span></a><a className="stats-back" href="./"><ArrowLeft size={15}/>返回战队组建</a></header>
    <main className="stats-shell">
      <section className="stats-intro"><div><span className="eyebrow"><BarChart3 size={13}/>WORLDS DRAFT / ACTIVITY</span><h1>数据统计</h1><p>查看战绩提交总量，以及每个匿名设备的提交次数。</p></div><button className="stats-refresh" onClick={() => setRevision(value => value + 1)} disabled={loading}>{loading ? <LoaderCircle size={15} className="spin"/> : <RefreshCw size={15}/>}刷新数据</button></section>
      <div className="stats-metrics" aria-busy={loading}>
        <Metric label="总提交次数" value={number(totals?.totalSubmissions)} note="成功入榜的独立战绩，重复上传只计一次" primary/>
        <Metric label="有提交的设备数" value={number(totals?.uniqueDevices)} note="按浏览器中的匿名标识去重"/>
        <Metric label="每设备平均提交" value={totals ? Number(totals.averageSubmissionsPerDevice || 0).toFixed(2) : '—'} note="已识别的战绩数 ÷ 有提交的设备数"/>
        <Metric label="未识别设备战绩" value={number(totals?.unattributedSubmissions)} note="含历史战绩，计入总提交，不参与设备均值"/>
      </div>
      {error && <div className="stats-error" role="alert"><WifiOff size={18}/><div><p>{error}</p>{data && <small>当前保留上次成功获取的数据。</small>}</div><button onClick={() => setRevision(value => value + 1)}>重试</button></div>}
      <section className="stats-players" aria-labelledby="stats-players-title" aria-busy={loading}>
        <header className="stats-panel-heading"><div><h2 id="stats-players-title"><Monitor size={17}/>每台设备的提交记录</h2><p>同一设备使用不同队名，提交次数仍合并计算。</p></div><span>{totals ? `${number(totals.identifiedSubmissions)} 次已识别提交` : '匿名设备统计'}</span></header>
        {players.length ? <div className="stats-table-wrap" role="region" aria-label="设备提交明细，可横向滑动" tabIndex={0}><table className="stats-table"><caption className="sr-only">按提交次数排序的匿名设备记录，包含使用过的队名、提交总次数和首次最近提交时间。</caption><thead><tr><th scope="col">匿名设备</th><th scope="col">提交次数</th><th scope="col">使用过的战队名</th><th scope="col">首次提交</th><th scope="col">最近提交</th></tr></thead><tbody>{players.map(player => <tr key={player.deviceLabel}><th scope="row"><span className="stats-device"><Monitor size={14}/>{player.deviceLabel}</span></th><td className="stats-submissions">{countFormat.format(player.submissions)}</td><td><div className="stats-names">{player.teamNames.map(name => <span key={name}>{name}</span>)}</div></td><td className="stats-time"><time dateTime={player.firstSubmissionAt}>{timeLabel(player.firstSubmissionAt)}</time></td><td className="stats-time"><time dateTime={player.lastSubmissionAt}>{timeLabel(player.lastSubmissionAt)}</time></td></tr>)}</tbody></table></div>
          : loading ? <div className="stats-empty" role="status"><LoaderCircle size={28} className="spin"/><p>正在获取提交统计…</p></div>
            : !error && <div className="stats-empty"><ClipboardList size={32}/><h3>还没有可识别的设备提交</h3><p>更新后的玩家完成一次世界赛，便会出现在这里。</p></div>}
        <footer className="stats-pagination"><span>{data?.updatedAt ? `更新于 ${timeLabel(data.updatedAt)} · 北京时间` : '时间以北京时间显示'}</span><div><button disabled={loading || page <= 1} onClick={() => changePage(page - 1)} aria-label="上一页"><ChevronLeft size={15}/></button><span>第 {page} / {totalPages} 页</span><button disabled={loading || page >= totalPages} onClick={() => changePage(page + 1)} aria-label="下一页"><ChevronRight size={15}/></button></div></footer>
      </section>
      <aside className="stats-explanation"><Info size={17}/><div><h2>统计口径</h2><p>匿名标识保存在当前浏览器中，用来近似区分设备，不代表真实人数。同一设备换浏览器、清除网站数据或使用无痕模式，可能被识别为新设备；同一人使用多台设备也会分别计算。更换网站域名后，设备标识也会重新生成。</p><p>仅统计成功上传的独立战绩。重试上传同一场比赛不增加次数；没有提交战绩的设备不计入设备数。浏览器禁止保存标识时，战绩计入未识别设备。</p>{totals?.unattributedSubmissions > 0 && <p>当前 {number(totals.unattributedSubmissions)} 次战绩没有设备信息，包含上线设备统计之前的历史记录，无法按玩家追溯分配。</p>}</div></aside>
      <footer className="stats-footer"><span>WORLDS DRAFT · 匿名提交统计</span><a href="./">返回战队组建<ArrowLeft size={13}/></a></footer>
    </main>
  </>;
}
