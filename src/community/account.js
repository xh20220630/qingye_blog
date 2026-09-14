import { api, getSession, escapeHtml as e, readLocal, writeLocal, shelfKeys } from '../lib/client.js';
const panel = document.querySelector('#account-panel');
let register = false;
async function render() {
  try {
    const { user } = await getSession(true);
    if (user) {
      panel.innerHTML = `<span class="community-kicker">WELCOME HOME</span><h2 class="account-name">${e(user.name)}，别来无恙。</h2><p class="community-muted">@${e(user.username)} · 同山道友</p><div class="community-actions"><a class="community-button" href="/shelf">展开袖囊 ↗</a></div><hr style="margin:25px 0;border:0;border-top:1px solid #d0dfd9" /><form class="community-form" id="profile-form"><label>称呼<input name="name" value="${e(user.name)}" maxlength="80" required /></label><button type="submit">保存称呼</button></form><details style="margin:25px 0"><summary class="community-muted">更改密码</summary><form class="community-form" id="password-form" style="margin-top:20px"><label>当前密码<input name="current" type="password" required autocomplete="current-password" /></label><label>新密码<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password" /></label><button type="submit">更新密码</button></form></details><button class="community-button secondary" id="account-logout">退出身份</button><p class="community-status" id="account-state" role="status"></p>`;
      bind('#profile-form', fields => api('/api/account', { method: 'PATCH', body: fields }), '称呼已更新');
      bind('#password-form', fields => api('/api/account/password', { method: 'POST', body: fields }), '密码已更新，其他设备的登录已退出');
      const localCount = readLocal('qy_favs', []).length + readLocal('qy_history', []).length;
      if (localCount) {
        const button = document.createElement('button'); button.className = 'community-button secondary'; button.textContent = '将访客袖囊导入此身份'; panel.querySelector('.community-actions').append(button);
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const favorites = readLocal('qy_favs', []), history = readLocal('qy_history', []), remote = (await api('/api/shelf')).items;
            const slugs = new Set([...favorites.map(f => f.slug), ...history.map(h => h.slug)]); let imported = 0;
            for (const slug of slugs) {
              const localHistory = history.find(h => h.slug === slug), cloudHistory = remote.find(h => h.slug === slug);
              try { await api('/api/shelf', { method: 'PUT', body: { slug, ...(favorites.some(f => f.slug === slug) ? { saved: true } : {}), ...(localHistory && (!cloudHistory || String(localHistory.updated) > cloudHistory.updated) ? { progress: localHistory.progress } : {}) } }); imported++; } catch {}
            }
            const keys = shelfKeys(user), merged = (await api('/api/shelf')).items;
            writeLocal(keys.favorites, merged.filter(i => i.saved)); writeLocal(keys.history, merged.filter(i => i.progress > 0));
            state(`已导入 ${imported} 卷，无法访问的旧卷会保留在访客袖囊。`);
          } catch (error) { state(error.message, true); } finally { button.disabled = false; }
        });
      }
      document.querySelector('#account-logout').addEventListener('click', async event => { event.target.disabled = true; try { await api('/api/auth/logout', { method: 'POST', body: {} }); await render(); } catch (error) { state(error.message, true); event.target.disabled = false; } });
      return;
    }
    panel.innerHTML = `<div class="community-tabs" role="tablist" aria-label="登录或注册"><button role="tab" id="login-tab" aria-selected="${!register}">道友归来</button><button role="tab" id="register-tab" aria-selected="${register}">初到山房</button></div><form class="community-form" id="account-form"><label>用户名<input name="username" required pattern="[a-zA-Z][a-zA-Z0-9_-]{2,39}" maxlength="40" autocomplete="username" placeholder="3–40 位英文、数字或下划线" /></label>${register ? '<label>称呼<input name="name" required maxlength="80" autocomplete="nickname" placeholder="愿山房如何称呼你" /></label>' : ''}<label>密码<input name="password" type="password" required minlength="${register ? 12 : 1}" maxlength="200" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? '至少 12 个字符' : '输入你的密码'}" /></label><button type="submit">${register ? '留下身份，入山' : '归来，继续阅卷'} →</button></form><p class="community-status" id="account-state" role="status"></p><p class="community-muted">${register ? '用户名用于登录，称呼会显示在公开留言中。请妥善保存密码。' : '忘记密码可联系山房主人协助找回。'}</p>`;
    document.querySelector('#login-tab').addEventListener('click', () => { register = false; void render(); }); document.querySelector('#register-tab').addEventListener('click', () => { register = true; void render(); });
    bind('#account-form', async fields => {
      await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: fields });
      await render();
    });
  } catch (error) { panel.innerHTML = `<h2>山路暂歇</h2><p class="community-muted">${e(error.message)}</p><button class="community-button" id="account-retry">重新连接</button>`; document.querySelector('#account-retry').addEventListener('click', render); }
}
function state(text, error = false) { const el = document.querySelector('#account-state'); if (el) { el.textContent = text; el.classList.toggle('is-error', error); } }
function bind(selector, work, message) { document.querySelector(selector).addEventListener('submit', async event => { event.preventDefault(); const button = event.target.querySelector('[type=submit]'); button.disabled = true; try { await work(Object.fromEntries(new FormData(event.target))); if (message) { state(message); if (selector === '#password-form') event.target.reset(); } } catch (error) { state(error.message, true); } finally { button.disabled = false; } }); }
void render();
