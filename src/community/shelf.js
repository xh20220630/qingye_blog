import { api, getSession, readLocal, writeLocal, shelfKeys, escapeHtml as e, downloadJSON } from '../lib/client.js';
let user, remote = [], tab = 'saved';
const state = document.querySelector('#shelf-state');
const items = () => {
  const keys = shelfKeys(user), saved = readLocal(keys.favorites, []), history = readLocal(keys.history, []), map = new Map();
  for (const item of history) map.set(item.slug, { ...item, saved: false });
  for (const item of saved) map.set(item.slug, { ...map.get(item.slug), ...item, saved: true });
  for (const item of remote) map.set(item.slug, { ...map.get(item.slug), ...item });
  return [...map.values()].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
};
function render() {
  const list = items().filter(i => tab === 'saved' ? i.saved : i.progress > 0);
  document.querySelector('#shelf-list').innerHTML = list.length ? list.map(item => `<article class="community-row"><div><h3><a href="/blog/${encodeURIComponent(item.slug)}/${tab === 'history' ? '?resume=1' : ''}">${e(item.title || item.slug)}</a></h3><p>${item.updated ? new Date(item.updated).toLocaleDateString('zh-CN') : '已收藏'}${item.progress ? ` · 已读 ${Math.round(item.progress * 100)}%` : ''}</p>${item.progress ? `<div class="shelf-progress" aria-hidden="true"><span style="width:${Math.round(item.progress * 100)}%"></span></div>` : ''}</div><div class="community-actions"><a class="community-button secondary" href="/blog/${encodeURIComponent(item.slug)}/?resume=1">${item.progress >= .98 ? '再读' : '展开'}</a><button class="community-button secondary" data-remove="${e(item.slug)}" aria-label="${tab === 'saved' ? '取消收藏' : '清除足迹'} ${e(item.title)}">移出</button></div></article>`).join('') : `<div class="community-empty"><b>${tab === 'saved' ? '袖囊尚轻，天地很宽。' : '尚未留下阅卷足迹。'}</b>${tab === 'saved' ? '文章末尾点击「收进袖囊」，便可在这里再次找到它。' : '翻开一卷书，山房会记住你停下的地方。'}</div>`;
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true; const slug = button.dataset.remove;
    try {
      if (user) await api('/api/shelf', { method: 'PUT', body: { slug, ...(tab === 'saved' ? { saved: false } : { progress: 0 }) } });
      const keys = shelfKeys(user);
      if (tab === 'saved') writeLocal(keys.favorites, readLocal(keys.favorites, []).filter(f => f.slug !== slug)); else writeLocal(keys.history, readLocal(keys.history, []).filter(h => h.slug !== slug));
      remote = remote.map(item => item.slug === slug ? { ...item, ...(tab === 'saved' ? { saved: 0 } : { progress: 0 }) } : item); render();
    } catch (error) { state.textContent = error.message; button.disabled = false; }
  }));
}
document.querySelectorAll('[data-shelf-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.shelfTab; document.querySelectorAll('[data-shelf-tab]').forEach(b => b.setAttribute('aria-selected', String(b === button))); render(); }));
document.querySelector('#shelf-export').addEventListener('click', () => downloadJSON('qingye-shelf.json', { exportedAt: new Date().toISOString(), items: items() }));
async function load() { try { user = (await getSession()).user; if (user) { remote = (await api('/api/shelf')).items; document.querySelector('#shelf-account').textContent = `${user.name} · 身份设置 →`; } state.textContent = user ? '已同步你的云端袖囊。' : '足迹保存在这台设备中，登录后可同步至其他设备。'; } catch { state.textContent = '正在查看本机袖囊，联网服务暂未连接。'; } render(); }
void load();
