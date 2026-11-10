const params = new URLSearchParams(location.search);
if (params.get('view') === 'stats') {
  document.title = '数据统计 — WORLDS DRAFT';
  Promise.all([import('./worlds/Statistics.jsx'), import('react'), import('react-dom/client')])
    .then(([{ default: Statistics }, { createElement }, { createRoot }]) => createRoot(document.getElementById('root')).render(createElement(Statistics)));
} else if (params.get('demo') === 'nindo') {
  document.title = '忍道 NINDO — 四人小队 · S级任务挑战';
  import('./main.jsx');
} else {
  import('./worlds/App.jsx');
}
