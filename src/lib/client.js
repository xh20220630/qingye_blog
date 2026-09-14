let currentSession;
let pendingSession;

export async function getSession(refresh = false) {
  if (currentSession && !refresh) return currentSession;
  if (!pendingSession) pendingSession = fetch('/api/session', { credentials: 'same-origin' }).then(async response => {
    if (!response.ok) throw new Error('互动服务暂未连接，请稍后重试');
    currentSession = await response.json(); return currentSession;
  }).finally(() => { pendingSession = undefined; });
  return pendingSession;
}
export async function api(url, { method = 'GET', body, binary, headers = {} } = {}) {
  const session = await getSession();
  const response = await fetch(url, { method, credentials: 'same-origin', headers: { ...(method !== 'GET' && !binary ? { 'Content-Type': 'application/json' } : {}), ...(session.csrf ? { 'X-CSRF-Token': session.csrf } : {}), ...headers }, body: binary || (body === undefined ? undefined : JSON.stringify(body)) });
  let data;
  try { data = await response.json(); } catch { throw new Error('服务返回异常，请稍后重试'); }
  if (!response.ok) { const error = new Error(data.error || '操作未完成'); error.status = response.status; throw error; }
  if (data.csrf && data.user) currentSession = { ...session, ...data };
  if (url === '/api/auth/logout') currentSession = undefined;
  return data;
}
export function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
export function writeLocal(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; } }
export function shelfKeys(user) { return user ? { favorites: `qy_favs_user_${user.id}`, history: `qy_history_user_${user.id}` } : { favorites: 'qy_favs', history: 'qy_history' }; }
export function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function downloadJSON(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
