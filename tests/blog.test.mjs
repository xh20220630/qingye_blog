import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server/app.mjs';
import { openStore } from '../server/core.mjs';
import { reviewComments } from '../server/comments.mjs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSchema } from '../src/lib/markdown-policy.mjs';

let app, origin, root, dataDir, owner, member, guest;
const secret = 'a-test-password-that-is-long';
function client() {
  const cookies = new Map(); let csrf;
  return { async call(url, method = 'GET', body, extra = {}) {
    const binary = Buffer.isBuffer(body);
    const response = await fetch(origin + url, { method, headers: { Origin: origin, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(method !== 'GET' ? { 'Content-Type': binary ? 'image/png' : 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...extra }, body: body === undefined ? undefined : binary ? body : JSON.stringify(body) });
    for (const value of response.headers.getSetCookie()) { const [name, content] = value.split(';')[0].split('='); cookies.set(name, content); }
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    if (data?.csrf) csrf = data.csrf;
    return { status: response.status, data, headers: response.headers };
  } };
}
before(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'qingye-blog-test-')); dataDir = path.join(root, 'private');
  mkdirSync(path.join(root, 'src/content/blog'), { recursive: true }); mkdirSync(path.join(root, 'static'), { recursive: true });
  writeFileSync(path.join(root, 'src/site-settings.json'), JSON.stringify({ name: '测试山房', author: '测试', subtitle: '', description: '', url: 'https://example.test', icp: '', announcement: '', links: [] }));
  writeFileSync(path.join(root, 'src/content/blog/published-post.md'), '---\ntitle: 已公开\ndescription: 公开摘要\npubDate: 2025-01-01\ncategory: 随笔\ntags: [读书]\n---\n## 公开章节\n公开正文。');
  writeFileSync(path.join(root, 'src/content/blog/private-post.md'), '---\ntitle: 私密草稿\ndescription: 不可公开\npubDate: 2025-01-01\ndraft: true\n---\n草稿正文');
  writeFileSync(path.join(root, 'src/content/blog/future-post.md'), '---\ntitle: 将来文章\ndescription: 不可提前公开\npubDate: 2099-01-01\n---\n未来正文');
  writeFileSync(path.join(root, 'static/index.html'), '<h1>稳定页面</h1>'); writeFileSync(path.join(root, 'static/404.html'), '没有这页');
  mkdirSync(path.join(root, 'static/blog/private-post'), { recursive: true }); writeFileSync(path.join(root, 'static/blog/private-post/index.html'), '旧版本中的已撤回内容');
  app = createApp({ root, dataDir, staticRoot: path.join(root, 'static') });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${app.server.address().port}`;
  owner = client(); guest = client(); member = client();
  const first = await owner.call('/api/auth/register', 'POST', { username: 'owner', name: '山房主人', password: secret }); assert.equal(first.status, 201);
  const registration = await member.call('/api/auth/register', 'POST', { username: 'reader', name: '读者', password: secret, role: 'admin' }); assert.equal(registration.status, 201);
});
after(() => { app.close(); });

test('新站点无需管理员即可注册，管理页面及接口彻底停用', async () => {
  assert.equal(existsSync(path.join(dataDir, 'setup-key.txt')), false);
  assert.equal((await member.call('/api/session')).data.user.role, undefined);
  for (const route of ['/admin/', '/ADMIN/index.html', '/admin//index.html', '/api/admin/posts', '/api/admin/rebuild', '/api/auth/setup']) {
    for (const method of ['GET', 'POST']) assert.equal((await owner.call(route, method, method === 'POST' ? {} : undefined)).status, 404, route);
  }
  assert.equal((await guest.call('/api/admin/posts')).status, 404);
});
test('会话要求同源与 CSRF，密码错误不会登录', async () => {
  assert.equal((await owner.call('/api/account', 'PATCH', { name: '修改称呼' }, { Origin: 'https://attacker.test' })).status, 403);
  assert.equal((await owner.call('/api/account', 'PATCH', { name: '修改称呼' }, { 'X-CSRF-Token': 'invalid' })).status, 403);
  assert.equal((await guest.call('/api/auth/login', 'POST', { username: 'owner', password: 'wrong' })).status, 401);
  const session = await owner.call('/api/session'); assert.ok(!('password' in session.data.user));
});
test('草稿和未来文章不会暴露给公开 API 或页面', async () => {
  assert.equal((await guest.call('/api/posts/published-post/stats')).status, 200);
  for (const slug of ['private-post', 'future-post']) {
    assert.equal((await guest.call(`/api/posts/${slug}/stats`)).status, 404);
    assert.equal((await guest.call(`/blog/${slug}/`)).status, 404);
    assert.equal((await guest.call(`/blog/${slug}/index.html`)).status, 404);
    assert.equal((await guest.call(`/blog//${slug}/`)).status, 404);
    assert.equal((await guest.call(`/api/comments?thread=${slug}`)).status, 404);
  }
});
test('访客留言待审，审核后公开，不能跨文章回复', async () => {
  const posted = await guest.call('/api/comments', 'POST', { thread: 'published-post', name: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script> 作为纯文本保存' }); assert.equal(posted.status, 201); assert.equal(posted.data.status, 'pending');
  assert.equal((await guest.call('/api/comments?thread=published-post')).data.total, 0);
  reviewComments(app.store, 'approve', [posted.data.id]);
  const visible = (await guest.call('/api/comments?thread=published-post')).data; assert.equal(visible.total, 1); assert.ok(!('user_id' in visible.items[0]));
  assert.equal((await guest.call('/api/comments', 'POST', { thread: 'guestbook', parent: posted.data.id, name: '访客', body: '跨文章回复' })).status, 400);
  assert.equal((await member.call('/api/admin/comments', 'PATCH', { ids: [posted.data.id], status: 'approved' })).status, 404);
  assert.equal((await guest.call('/api/comments?thread=published-post&page=1.001')).status, 400);
});
test('阅读按访客和日期去重，点赞幂等，收藏与进度可同步', async () => {
  await guest.call('/api/posts/published-post/view', 'POST', {}); const view = await guest.call('/api/posts/published-post/view', 'POST', {}); assert.equal(view.data.views, 1);
  await guest.call('/api/posts/published-post/like', 'POST', { liked: true }); assert.equal((await guest.call('/api/posts/published-post/like', 'POST', { liked: true })).data.likes, 1);
  assert.equal((await guest.call('/api/posts/published-post/like', 'POST', { liked: false })).data.likes, 0);
  assert.equal((await member.call('/api/shelf', 'PUT', { slug: 'published-post', saved: true, progress: .62 })).status, 200);
  await member.call('/api/shelf', 'PUT', { slug: 'published-post', progress: .8 });
  const shelf = (await member.call('/api/shelf')).data.items[0]; assert.equal(shelf.saved, 1); assert.equal(shelf.progress, .8);
  assert.equal((await guest.call('/api/shelf')).status, 401);
});
test('重启从 Markdown 读取内容，已有读者收藏继续保留', () => {
  const file = path.join(root, 'src/content/blog/local-story.md');
  writeFileSync(file, '---\ntitle: 本地新卷\npubDate: 2025-01-01\n---\n正文');
  const second = openStore({ root, dataDir });
  assert.equal(second.publicPost('local-story').title, '本地新卷');
  assert.equal(second.get("SELECT count(*) n FROM shelves WHERE slug='published-post'").n, 1);
  second.db.close();
  writeFileSync(file, '---\ntitle: 本地新卷\npubDate: 2025-01-01\ndraft: true\n---\n正文');
  const third = openStore({ root, dataDir });
  assert.equal(third.publicPost('local-story'), null);
  third.db.close();
});
test('实际发布管线保留代码高亮和目录，移除可执行 HTML', async () => {
  const renderer = await createMarkdownProcessor({ rehypePlugins: [[rehypeSanitize, markdownSchema]] });
  const result = await renderer.render('## Safe heading\n\n<script>alert(1)</script>\n<img src="x" onerror="alert(1)">\n\n```js\nconst value = 1;\n```');
  assert.match(result.code, /style="color:#[A-Fa-f0-9]+/);
  assert.ok(!/script|onerror|javascript:/.test(result.code));
  assert.match(result.code, new RegExp(`id="${result.metadata.headings[0].slug}"`));
});
test('旧管理员账号没有隐含权限，留言仍需审核', async () => {
  const user = (await owner.call('/api/session')).data.user;
  app.store.run("UPDATE users SET role='admin' WHERE id=?", user.id);
  const session = (await owner.call('/api/session')).data;
  assert.equal(session.needsSetup, undefined);
  assert.equal(session.user.role, undefined);
  assert.equal((await owner.call('/api/admin/users')).status, 404);
  const comment = await owner.call('/api/comments', 'POST', { thread: 'guestbook', body: '旧身份也是普通读者' });
  assert.equal(comment.data.status, 'pending');
  assert.equal(reviewComments(app.store, 'pending').length, 1);
  assert.throws(() => reviewComments(app.store, 'approve', [comment.data.id, 999999]));
  assert.equal(app.store.get('SELECT status FROM comments WHERE id=?', comment.data.id).status, 'pending');
});
test('密码修改撤销旧会话，新的密码可登录', async () => {
  const stale = client(); await stale.call('/api/auth/login', 'POST', { username: 'reader', password: secret });
  const changed = await member.call('/api/account/password', 'POST', { current: secret, password: 'a-different-safe-password' }); assert.equal(changed.status, 200);
  assert.equal((await stale.call('/api/session')).data.user, null);
  assert.equal((await stale.call('/api/auth/login', 'POST', { username: 'reader', password: 'a-different-safe-password' })).status, 200);
});
