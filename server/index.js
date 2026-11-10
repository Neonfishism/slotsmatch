import { createServer } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream';
import { createGzip } from 'node:zlib';
import { ApiError, createLeaderboardStore } from './leaderboard.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);

function acceptsGzip(header = '') {
  const encodings = String(header).split(',').map(item => {
    const [name, ...parameters] = item.trim().toLowerCase().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    return { name, quality: quality === undefined ? 1 : Number(quality.trim().slice(2)) };
  });
  const preference = encodings.find(encoding => encoding.name === 'gzip') || encodings.find(encoding => encoding.name === '*');
  return preference?.quality > 0;
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body), 'x-content-type-options': 'nosniff' });
  res.end(body);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new ApiError(415, '请求需要使用 JSON 格式。');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16 * 1024) throw new ApiError(413, '请求内容过大。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'JSON 格式无效。'); }
}

function within(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function createAppServer({ store, dbPath, distPath = resolve(ROOT, 'dist'), trustProxy = process.env.TRUST_PROXY === '1', now = Date.now } = {}) {
  const database = store || createLeaderboardStore({ dbPath });
  const rateBuckets = new Map();
  let lastPrune = 0;
  function checkRate(req, action) {
    const timestamp = now();
    if (timestamp - lastPrune > 60000) {
      for (const [key, bucket] of rateBuckets) if (timestamp - bucket.start > 3600000) rateBuckets.delete(key);
      lastPrune = timestamp;
    }
    const peer = trustProxy ? String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
    const key = `${peer}:${action}`;
    const limit = action === 'create' ? 120 : 240;
    const bucket = rateBuckets.get(key);
    if (!bucket || timestamp - bucket.start > 3600000) { rateBuckets.set(key, { start: timestamp, count: 1 }); return; }
    if (++bucket.count > limit) throw new ApiError(429, '操作过于频繁，请稍后重试。');
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        // The app uses relative requests. Cross-origin writes are rejected even
        // when a public reverse proxy forwards requests to this HTTP listener.
        if (req.method === 'POST' && req.headers.origin) {
          let originHost;
          try { originHost = new URL(req.headers.origin).host; } catch { throw new ApiError(403, '请求来源无效。'); }
          const requestHost = String(trustProxy ? req.headers['x-forwarded-host'] || req.headers.host : req.headers.host).split(',')[0].trim();
          if (originHost !== requestHost) throw new ApiError(403, '请求来源与当前站点不一致。');
        }
        if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, tournamentYear: 2026 });
        if (url.pathname === '/api/stats' && req.method === 'GET') {
          return json(res, 200, database.stats({
            page: url.searchParams.has('page') ? Number(url.searchParams.get('page')) : 1,
            pageSize: url.searchParams.has('pageSize') ? Number(url.searchParams.get('pageSize')) : 25,
          }));
        }
        if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
          const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 10;
          return json(res, 200, database.list({ limit, entryId: url.searchParams.get('entryId') || undefined }));
        }
        if (url.pathname === '/api/runs' && req.method === 'POST') {
          checkRate(req, 'create');
          return json(res, 201, database.createRun(await readJson(req)));
        }
        if (url.pathname === '/api/leaderboard' && req.method === 'POST') {
          checkRate(req, 'submit');
          const result = database.submit(await readJson(req));
          return json(res, result.duplicate ? 200 : 201, result);
        }
        throw new ApiError(404, '接口不存在。');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, '不支持此请求方法。');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new ApiError(400, '路径无效。'); }
      if (pathname.includes('\0') || pathname.includes('\\')) throw new ApiError(400, '路径无效。');
      const dist = resolve(distPath);
      let file = resolve(dist, `.${pathname}`);
      if (!within(dist, file)) throw new ApiError(403, '无法访问该路径。');
      if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
      if (!existsSync(file) && !extname(pathname) && req.headers.accept?.includes('text/html')) file = resolve(dist, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile() || !within(realpathSync(dist), realpathSync(file))) throw new ApiError(404, '页面不存在。');
      const info = statSync(file);
      const compressible = info.size >= 1024 && COMPRESSIBLE.has(extname(file));
      const gzip = compressible && acceptsGzip(req.headers['accept-encoding']);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        ...(gzip ? { 'content-encoding': 'gzip' } : { 'content-length': info.size }),
        ...(compressible ? { vary: 'Accept-Encoding' } : {}),
        'cache-control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin',
      });
      if (req.method === 'HEAD') res.end();
      else {
        const streams = gzip ? [createReadStream(file), createGzip(), res] : [createReadStream(file), res];
        pipeline(...streams, error => { if (error) res.destroy(); });
      }
    } catch (error) {
      if (res.headersSent) return res.destroy();
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 500) console.error('Request failed:', error);
      json(res, status, { error: status === 500 ? '服务器暂时无法处理请求，请稍后重试。' : error.message });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => { if (!store) database.close(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createAppServer();
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => console.log(`WORLDS DRAFT serving at http://${host}:${port}`));
  const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
