import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { openStore, assert, string, token, digest, passwordHash, passwordMatches, HttpError } from './core.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const publicUser = (user) => user ? { id: user.id, username: user.username, name: user.name } : null;
const dateNow = () => new Date().toISOString();

async function readBody(req, limit = 1024 * 1024) {
  assert(Number(req.headers['content-length'] || 0) <= limit, 413, '上传内容过大');
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; assert(size <= limit, 413, '上传内容过大'); parts.push(part); }
  return Buffer.concat(parts);
}
export function createApp(options = {}) {
  const store = options.store || openStore(options);
  const staticRoot = path.resolve(options.staticRoot || process.env.QY_STATIC_DIR || path.join(store.root, 'dist'));
  const rates = new Map();
  const dummyPassword = passwordHash(token());
  const siteOrigin = (process.env.SITE_URL || 'http://127.0.0.1:4324').replace(/\/$/, '');
  const rate = (key, max, period = 60000) => {
    const now = Date.now(); let entry = rates.get(key);
    if (!entry || entry.until <= now) { entry = { n: 0, until: now + period }; rates.set(key, entry); }
    assert(++entry.n <= max, 429, '操作太频繁，请稍后重试');
  };
  const timer = setInterval(() => {
    try { store.run('DELETE FROM sessions WHERE expires<?', Date.now()); for (const [key, entry] of rates) if (entry.until < Date.now()) rates.delete(key); } catch (error) { console.error('Session cleanup:', error.message); }
  }, 30000);
  timer.unref();

  const server = http.createServer(async (req, res) => {
    const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      const host = req.headers.host || '127.0.0.1';
      const url = new URL(req.url, `http://${host}`);
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, '地址编码不正确'); }
      assert(!/^\/(?:admin(?:\/|$)|api\/admin(?:\/|$)|api\/auth\/setup(?:\/|$))/i.test(path.posix.normalize(pathname)), 404, '页面或接口不存在');
      const method = req.method;
      const ip = digest(req.socket.remoteAddress || 'unknown');
      const cookie = Object.fromEntries((req.headers.cookie || '').split(';').map(p => { const at = p.indexOf('='); return at > 0 ? [p.slice(0, at).trim(), p.slice(at + 1)] : ['', '']; }));
      const secure = Boolean(req.socket.encrypted || (process.env.QY_TRUST_PROXY === 'true' && req.headers['x-forwarded-proto'] === 'https'));
      const setCookie = (name, value, age) => { const previous = res.getHeader('Set-Cookie') || []; res.setHeader('Set-Cookie', [...previous, `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`]); };
      const session = cookie.qy_session ? store.get('SELECT sessions.*,users.username,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND expires>?', digest(cookie.qy_session), Date.now()) : null;
      const user = session ? { ...session, id: session.user_id } : null;
      let visitor = cookie.qy_visitor;
      if (!/^[A-Za-z0-9_-]{43}$/.test(visitor || '')) { visitor = token(); if (pathname.startsWith('/api/')) setCookie('qy_visitor', visitor, 31536000); }
      const visitorKey = digest(user ? `user:${user.id}` : visitor);
      const requireUser = () => { assert(user, 401, '请先登录'); return user; };
      if (pathname.startsWith('/api/')) {
        rate(`api:${ip}`, 360);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          const origin = req.headers.origin;
          const expected = new Set([siteOrigin, `${secure ? 'https' : 'http'}://${host}`, ...(options.origins || [])]);
          if (process.env.NODE_ENV !== 'production' && /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '')) { expected.add('http://127.0.0.1:4322'); expected.add('http://localhost:4322'); }
          assert(origin && expected.has(origin), 403, '请求来源验证失败');
          if (session) assert(req.headers['x-csrf-token'] === session.csrf, 403, '会话验证失败，请刷新页面');
        }
        let body = {};
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
          assert(req.headers['content-type']?.startsWith('application/json'), 415, '请使用 JSON 格式');
          try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch (error) { if (error.status) throw error; throw new HttpError(400, 'JSON 格式不正确'); }
          assert(body && typeof body === 'object' && !Array.isArray(body), 400, '请求格式不正确');
        }
        const login = (account) => {
          const raw = token(), csrf = token();
          store.run('INSERT INTO sessions(id,user_id,csrf,expires) VALUES(?,?,?,?)', digest(raw), account.id, csrf, Date.now() + 30 * 86400000);
          setCookie('qy_session', raw, 30 * 86400);
          return { user: publicUser(account), csrf };
        };
        if (pathname === '/api/health' && method === 'GET') { store.get('SELECT 1'); return json({ ok: true }); }
        if (pathname === '/api/session' && method === 'GET') return json({ user: publicUser(user), csrf: session?.csrf });
        if (pathname === '/api/auth/register' && method === 'POST') {
          rate(`register:${ip}`, 3, 3600000);
          const username = string(body.username, 40).toLowerCase(), name = string(body.name, 80) || username;
          assert(/^[a-z][a-z0-9_-]{2,39}$/.test(username), 400, '用户名需为 3–40 位英文、数字、下划线或短横线');
          assert(!store.get('SELECT id FROM users WHERE username=?', username), 409, '用户名已被使用');
          const password = await passwordHash(body.password);
          try { const id = Number(store.run('INSERT INTO users(username,name,password,created) VALUES(?,?,?,?)', username, name, password, dateNow()).lastInsertRowid); return json(login(store.get('SELECT * FROM users WHERE id=?', id)), 201); }
          catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, '用户名已被使用'); throw error; }
        }
        if (pathname === '/api/auth/login' && method === 'POST') {
          rate(`login:${ip}`, 12, 900000);
          const account = store.get('SELECT * FROM users WHERE username=?', string(body.username, 40).toLowerCase());
          const valid = await passwordMatches(body.password, account?.password || await dummyPassword);
          assert(account && valid, 401, '用户名或密码不正确');
          store.audit(account.id, 'auth.login'); return json(login(account));
        }
        if (pathname === '/api/auth/logout' && method === 'POST') { if (session) store.run('DELETE FROM sessions WHERE id=?', session.id); setCookie('qy_session', '', 0); return json({ ok: true }); }
        if (pathname === '/api/account' && method === 'PATCH') {
          requireUser(); const name = string(body.name, 80); assert(name, 400, '请填写昵称'); store.run('UPDATE users SET name=? WHERE id=?', name, user.id); return json({ user: publicUser({ ...user, name }) });
        }
        if (pathname === '/api/account/password' && method === 'POST') {
          requireUser(); rate(`password:${user.id}`, 5, 900000);
          assert(await passwordMatches(body.current, store.get('SELECT password FROM users WHERE id=?', user.id).password), 403, '原密码不正确');
          const hash = await passwordHash(body.password);
          store.transaction(() => { store.run('UPDATE users SET password=? WHERE id=?', hash, user.id); store.run('DELETE FROM sessions WHERE user_id=?', user.id); });
          return json(login(user));
        }
        if (pathname === '/api/shelf' && method === 'GET') {
          requireUser(); const items = store.all('SELECT * FROM shelves WHERE user_id=? ORDER BY updated DESC LIMIT 1000', user.id).map(item => ({ ...item, title: store.publicPost(item.slug)?.title || item.slug, available: Boolean(store.publicPost(item.slug)) })); return json({ items });
        }
        if (pathname === '/api/shelf' && method === 'PUT') {
          requireUser(); const slug = string(body.slug, 100);
          const existing = store.get('SELECT * FROM shelves WHERE user_id=? AND slug=?', user.id, slug);
          assert(store.publicPost(slug) || existing && (body.saved === false || body.progress === 0), 404, '文章尚未公开');
          const progress = body.progress === undefined ? existing?.progress || 0 : Number(body.progress);
          assert(Number.isFinite(progress) && progress >= 0 && progress <= 1, 400, '阅读进度不正确');
          store.run('INSERT INTO shelves(user_id,slug,saved,progress,updated) VALUES(?,?,?,?,?) ON CONFLICT(user_id,slug) DO UPDATE SET saved=excluded.saved,progress=excluded.progress,updated=excluded.updated', user.id, slug, body.saved === undefined ? existing?.saved || 0 : Number(Boolean(body.saved)), progress, dateNow());
          return json({ ok: true });
        }
        if (pathname === '/api/shelf' && method === 'DELETE') { requireUser(); store.run('DELETE FROM shelves WHERE user_id=? AND slug=?', user.id, string(body.slug, 100)); return json({ ok: true }); }
        const postMatch = pathname.match(/^\/api\/posts\/([a-z0-9-]+)\/(stats|like|view)$/);
        if (postMatch) {
          const [, slug, action] = postMatch; assert(store.publicPost(slug), 404, '文章尚未公开');
          if (action === 'like' && method === 'POST') {
            rate(`like:${visitorKey}`, 30);
            if (body.liked) store.run('INSERT OR IGNORE INTO reactions VALUES(?,?)', slug, visitorKey); else store.run('DELETE FROM reactions WHERE slug=? AND visitor=?', slug, visitorKey);
          } else if (action === 'view' && method === 'POST') store.run('INSERT OR IGNORE INTO views VALUES(?,?,?)', slug, visitorKey, dateNow().slice(0, 10));
          else assert(action === 'stats' && method === 'GET', 405, '请求方法不支持');
          return json({ likes: store.get('SELECT count(*) n FROM reactions WHERE slug=?', slug).n, views: store.get('SELECT count(*) n FROM views WHERE slug=?', slug).n, liked: Boolean(store.get('SELECT 1 FROM reactions WHERE slug=? AND visitor=?', slug, visitorKey)) });
        }
        if (pathname === '/api/comments' && method === 'GET') {
          const thread = url.searchParams.get('thread') || 'guestbook'; assert(thread === 'guestbook' || store.publicPost(thread), 404, '文章尚未公开');
          const page = Number(url.searchParams.get('page') || 1);
          assert(Number.isSafeInteger(page) && page >= 1 && page <= 10000, 400, '页码不正确');
          const total = store.get("SELECT count(*) n FROM comments WHERE thread=? AND status='approved'", thread).n;
          const items = store.all("SELECT id,parent,name,body,created FROM comments WHERE thread=? AND status='approved' ORDER BY id DESC LIMIT 20 OFFSET ?", thread, (page - 1) * 20);
          return json({ items, total, page, enabled: thread === 'guestbook' || store.publicPost(thread).commentsEnabled !== false });
        }
        if (pathname === '/api/comments' && method === 'POST') {
          rate(`comment:${ip}`, 5, 600000);
          const thread = string(body.thread, 100), post = store.publicPost(thread);
          assert(thread === 'guestbook' || post?.commentsEnabled !== false && post, 403, '这卷文章暂未开放评论');
          assert(!body.website, 400, '提交未通过验证');
          const name = user?.name || string(body.name, 60), content = string(body.body, 3000);
          assert(name && content.length >= 2, 400, '请填写称呼与至少两个字的留言');
          const parent = body.parent ? Number(body.parent) : null;
          if (parent) assert(store.get("SELECT id FROM comments WHERE id=? AND thread=? AND status='approved'", parent, thread), 400, '回复的留言不存在');
          const status = 'pending';
          const id = Number(store.run('INSERT INTO comments(thread,parent,user_id,name,body,status,created) VALUES(?,?,?,?,?,?,?)', thread, parent, user?.id || null, name, content, status, dateNow()).lastInsertRowid);
          return json({ id, status, message: '留音已送达，审核通过后会出现在这里' }, 201);
        }
        throw new HttpError(404, '接口不存在');
      }
      assert(method === 'GET' || method === 'HEAD', 405, '请求方法不支持');
      assert(!pathname.includes('\\') && !pathname.includes('\0') && !pathname.split('/').some(p => p.startsWith('.')), 404, '页面不存在');
      let root = staticRoot, relative = pathname;
      if (pathname.startsWith('/media/')) { root = path.join(store.dataDir, 'media'); relative = pathname.slice(6); assert(/^\/[a-f0-9]{64}\.(png|jpg|webp|gif|avif)$/.test(relative), 404, '图片不存在'); }
      const article = path.posix.normalize(pathname).match(/^\/blog\/([a-z0-9-]+)(?:\/(?:index\.html)?)?$/);
      if (article && !/^\d+$/.test(article[1])) assert(store.publicPost(article[1]), 404, '文章尚未公开');
      const filename = path.resolve(root, `.${relative}`);
      assert(filename === root || filename.startsWith(root + path.sep), 404, '页面不存在');
      let file = filename, status = 200;
      if (existsSync(file) && statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) { res.writeHead(308, { Location: `${url.pathname}/${url.search}` }); return res.end(); }
        file = path.join(file, 'index.html');
      }
      if (!existsSync(file) || !statSync(file).isFile()) { file = path.join(root, '404.html'); status = 404; }
      if (!existsSync(file)) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('站点页面尚未构建。请先运行 npm run build。'); }
      res.writeHead(status, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': /\/_astro\/|\/media\//.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache', 'Content-Length': statSync(file).size });
      if (method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      const status = error.status || 500;
      if (status === 500) console.error('Request:', error.message);
      if (status === 429) res.setHeader('Retry-After', '60');
      json({ error: status === 500 ? '服务暂时不可用，请稍后再试' : error.message }, status);
    }
  });
  server.headersTimeout = 15000; server.requestTimeout = 30000;
  return { server, store, close() { clearInterval(timer); server.close(); store.db.close(); } };
}
