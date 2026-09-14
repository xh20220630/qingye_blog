import { api, getSession, readLocal, writeLocal, shelfKeys } from '../lib/client.js';

const box = document.querySelector('.post-actions');
if (box) {
  const slug = box.dataset.slug, title = box.dataset.title, status = document.querySelector('#post-service-status');
  const like = document.querySelector('#qy-like'), likeN = document.querySelector('#qy-like-n'), favorite = document.querySelector('#qy-fav');
  let user, liked = false, ready = false, cloudSaved, progress = 0, lastSync = 0, keys = shelfKeys(null);
  const message = text => { status.textContent = text; };
  const syncFav = () => { const saved = cloudSaved ?? readLocal(keys.favorites, []).some(f => f.slug === slug); favorite.setAttribute('aria-pressed', String(saved)); favorite.classList.toggle('is-on', saved); document.querySelector('#qy-fav-label').textContent = saved ? '已在袖囊' : '收进袖囊'; };
  const syncStats = data => { liked = data.liked; likeN.textContent = String(data.likes); like.setAttribute('aria-pressed', String(liked)); like.classList.toggle('is-on', liked); const views = document.querySelector('#post-views'); if (views) views.textContent = `${data.views} 次阅卷`; };
  async function connect() {
    try { user = (await getSession()).user; keys = shelfKeys(user); const stats = await api(`/api/posts/${slug}/stats`); syncStats(stats); ready = true; message('');
      if (user) { const shelf = (await api('/api/shelf')).items.find(item => item.slug === slug); cloudSaved = Boolean(shelf?.saved); syncFav(); if (shelf?.progress && !readLocal(keys.history, []).some(h => h.slug === slug)) offerResume(shelf.progress); }
    } catch { message('互动服务暂未连接，收藏与足迹仍可保存在本机。'); }
    const previous = readLocal(keys.history, []).find(h => h.slug === slug); if (previous) offerResume(previous.progress); syncFav();
  }
  like.addEventListener('click', async () => { like.disabled = true; try { if (!ready) await connect(); if (!ready) return; syncStats(await api(`/api/posts/${slug}/like`, { method: 'POST', body: { liked: !liked } })); } catch (error) { message(error.message); } finally { like.disabled = false; } });
  favorite.addEventListener('click', async () => {
    favorite.disabled = true;
    try {
      const next = favorite.getAttribute('aria-pressed') !== 'true';
      let favs = readLocal(keys.favorites, []).filter(f => f.slug !== slug); if (next) favs.push({ slug, title, updated: new Date().toISOString() });
      const localSaved = writeLocal(keys.favorites, favs);
      if (user) { await api('/api/shelf', { method: 'PUT', body: { slug, saved: next } }); cloudSaved = next; }
      message(user ? '袖囊已同步' : localSaved ? '已保存到本机袖囊' : '浏览器不允许存储，请登录后使用云端袖囊'); syncFav();
    } catch (error) { cloudSaved = undefined; syncFav(); message(`本机已记录，云端同步失败：${error.message}`); } finally { favorite.disabled = false; }
  });
  document.querySelector('#qy-share').addEventListener('click', async () => {
    const url = new URL(location.pathname, location.origin).href;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (error) { if (error.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); message('文章链接已复制'); } catch { message(`文章地址：${url}`); }
  });
  const body = document.querySelector('#juan-body');
  const getProgress = () => { if (!body) return 0; const rect = body.getBoundingClientRect(); return Math.max(0, Math.min(1, (window.innerHeight * .7 - rect.top) / Math.max(1, rect.height - window.innerHeight * .3))); };
  function record() {
    progress = getProgress();
    if (progress <= 0) return;
    const items = readLocal(keys.history, []).filter(h => h.slug !== slug);
    items.unshift({ slug, title, progress, updated: new Date().toISOString() }); writeLocal(keys.history, items.slice(0, 300));
    if (user && Date.now() - lastSync > 15000) { lastSync = Date.now(); void api('/api/shelf', { method: 'PUT', body: { slug, progress } }).catch(() => {}); }
  }
  function offerResume(ratio) {
    const resume = document.querySelector('#reading-resume'); if (!resume || ratio < .05 || ratio > .98) return;
    resume.hidden = false; document.querySelector('#resume-label').textContent = `上次读到 ${Math.round(ratio * 100)}%，接着往下读？`;
    const jump = () => { const top = body.getBoundingClientRect().top + window.scrollY; window.scrollTo({ top: top + ratio * Math.max(1, body.offsetHeight - innerHeight * .3) - innerHeight * .7, behavior: 'auto' }); resume.hidden = true; };
    document.querySelector('#resume-reading').onclick = jump; document.querySelector('#dismiss-resume').onclick = () => resume.hidden = true;
    if (new URLSearchParams(location.search).get('resume') === '1') setTimeout(jump, 100);
  }
  let scrollTimer;
  window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(record, 900); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) record(); });
  const viewObserver = new IntersectionObserver(entries => { if (!entries.some(entry => entry.isIntersecting)) return; viewObserver.disconnect(); setTimeout(() => { if (!document.hidden) void api(`/api/posts/${slug}/view`, { method: 'POST', body: {} }).then(syncStats).catch(() => {}); }, 2500); });
  if (body) viewObserver.observe(body);
  syncFav(); void connect();
}
