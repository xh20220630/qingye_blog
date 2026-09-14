import { api, getSession, escapeHtml as e, readLocal, writeLocal } from '../lib/client.js';

const section = document.querySelector('#comments');
if (section) {
  const thread = section.dataset.thread, form = section.querySelector('form'), state = document.querySelector('#comment-state');
  let page = 1, parent = null;
  const draftKey = `qy_comment_draft_${thread}`, draft = readLocal(draftKey, {});
  form.elements.name.value = draft.name || ''; form.elements.body.value = draft.body || '';
  form.addEventListener('input', () => writeLocal(draftKey, { name: form.elements.name.value, body: form.elements.body.value }));
  const message = (text, error = false) => { state.textContent = text; state.classList.toggle('is-error', error); };
  const resetReply = () => { parent = null; document.querySelector('#reply-target').textContent = ''; document.querySelector('#cancel-reply').hidden = true; };
  document.querySelector('#cancel-reply').addEventListener('click', resetReply);
  async function load() {
    try {
      const session = await getSession();
      if (session.user) { document.querySelector('#comment-name-label').hidden = true; form.elements.name.required = false; document.querySelector('#comment-identity').textContent = `以 ${session.user.name} 的身份留音`; }
      const data = await api(`/api/comments?thread=${encodeURIComponent(thread)}&page=${page}`);
      form.hidden = !data.enabled;
      document.querySelector('#comment-list').innerHTML = data.items.length ? data.items.map(c => `<article class="comment-item" id="comment-${c.id}"><header><span class="comment-avatar" aria-hidden="true">${e(c.name.slice(0, 1))}</span><b>${e(c.name)}</b><time datetime="${e(c.created)}">${new Date(c.created).toLocaleString('zh-CN')}</time></header>${c.parent ? `<p class="comment-parent">回复留音 #${c.parent}</p>` : ''}<p>${e(c.body)}</p>${data.enabled ? `<button class="comment-reply" data-reply="${c.id}" data-name="${e(c.name)}">回一封信 ↗</button>` : ''}</article>`).join('') : '<div class="community-empty"><b>山静，等一声回音。</b>还没有公开留言。你的思考，或许就是下一段对话的开始。</div>';
      const pages = Math.max(1, Math.ceil(data.total / 20));
      document.querySelector('#comment-pagination').innerHTML = pages > 1 ? `<button data-page="-1" ${page === 1 ? 'disabled' : ''}>上一页</button><span>${page} / ${pages}</span><button data-page="1" ${page >= pages ? 'disabled' : ''}>下一页</button>` : '';
      message(data.enabled ? `${data.total} 缕公开回音` : '这卷文章已关闭新留言。');
    } catch (error) { message(error.message, true); document.querySelector('#comment-list').innerHTML = '<button class="community-button secondary" id="retry-comments">重新听取</button>'; document.querySelector('#retry-comments').addEventListener('click', load); }
  }
  section.addEventListener('click', event => {
    const reply = event.target.closest('[data-reply]'), pager = event.target.closest('[data-page]');
    if (reply) { parent = Number(reply.dataset.reply); document.querySelector('#reply-target').textContent = `回复 ${reply.dataset.name}`; document.querySelector('#cancel-reply').hidden = false; form.elements.body.focus(); }
    if (pager) { page += Number(pager.dataset.page); void load(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { const data = await api('/api/comments', { method: 'POST', body: { ...Object.fromEntries(new FormData(form)), thread, parent } }); form.elements.body.value = ''; writeLocal(draftKey, { name: form.elements.name.value }); resetReply(); await load(); message(data.message); }
    catch (error) { message(error.message, true); } finally { button.disabled = false; }
  });
  void load();
}
