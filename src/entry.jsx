const classic = new URLSearchParams(location.search).get('demo') === 'nindo';
if (classic) {
  document.title = '忍道 NINDO — 四人小队 · S级任务挑战';
  import('./main.jsx');
} else {
  import('./worlds/App.jsx');
}
