export class OnlineApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'OnlineApiError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson(path, { signal, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: controller.signal,
    });
    let data;
    try { data = await response.json(); }
    catch { throw new OnlineApiError('排行榜服务暂时无法连接，请稍后重试。', { status: response.status }); }
    if (!response.ok) {
      const message = typeof data.message === 'string' ? data.message
        : typeof data.error === 'string' ? data.error
          : data.error?.message || '请求未完成，请稍后重试。';
      throw new OnlineApiError(message, { status: response.status, code: data.code || data.error?.code || '' });
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof OnlineApiError) throw error;
    throw new OnlineApiError(controller.signal.aborted ? '连接超时，请检查网络后重试。' : '无法连接排行榜服务，请检查网络后重试。');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function createOnlineRun({ teamName, mode = 'free', seed } = {}) {
  return requestJson('/api/runs', { method: 'POST', body: JSON.stringify({ teamName, mode, ...(seed ? { seed } : {}) }) });
}

export function submitOnlineRun({ runId, actions, team } = {}) {
  return requestJson('/api/leaderboard', { method: 'POST', body: JSON.stringify({ runId, actions, team }) });
}

export function fetchLeaderboard({ entryId, signal } = {}) {
  const params = new URLSearchParams({ limit: '10' });
  if (entryId) params.set('entryId', entryId);
  return requestJson(`/api/leaderboard?${params}`, { signal });
}
