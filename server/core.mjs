import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const token = () => randomBytes(32).toString('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function assert(condition, status, message) { if (!condition) throw new HttpError(status, message); }
export function string(value, max = 200, fallback = '') {
  assert(value === undefined || typeof value === 'string', 400, '字段格式不正确');
  const result = (value ?? fallback).trim();
  assert(result.length <= max, 400, `内容超出 ${max} 字限制`);
  return result;
}
export function atomicWrite(filename, data) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(temporary, data, { mode: 0o600 });
  renameSync(temporary, filename);
}
const scrypt = promisify(scryptCallback);
export async function passwordHash(password) {
  assert(typeof password === 'string' && password.length >= 12 && password.length <= 200, 400, '密码需为 12–200 个字符');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const [salt, hash] = encoded.split(':');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export function openStore() {
  const root = projectRoot;
  const dataDir = path.resolve(process.env.QY_DATA_DIR || path.join(os.homedir(), '.qingye-blog', digest(root).slice(0, 12)));
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(path.join(dataDir, 'media'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'blog.sqlite'), { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, thread TEXT NOT NULL, parent INTEGER REFERENCES comments(id), user_id INTEGER REFERENCES users(id), name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_thread ON comments(thread,status,created);
    CREATE TABLE IF NOT EXISTS reactions(slug TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY(slug,visitor));
    CREATE TABLE IF NOT EXISTS views(slug TEXT NOT NULL, visitor TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(slug,visitor,day));
    CREATE TABLE IF NOT EXISTS shelves(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, slug TEXT NOT NULL, saved INTEGER NOT NULL DEFAULT 0, progress REAL NOT NULL DEFAULT 0, updated TEXT NOT NULL, PRIMARY KEY(user_id,slug));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor INTEGER, action TEXT NOT NULL, target TEXT NOT NULL, created TEXT NOT NULL);
  `);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = (work) => { db.exec('BEGIN IMMEDIATE'); try { const value = work(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const audit = (actor, action, target = '') => run('INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)', actor ?? null, action, String(target), new Date().toISOString());
  const sourceDir = path.join(root, 'src', 'content', 'blog');
  const posts = new Map();
  // Markdown remains the source of truth; legacy database drafts must never replace it.
  try {
    if (existsSync(sourceDir)) for (const filename of readdirSync(sourceDir).filter(f => f.endsWith('.md'))) {
      const { data } = matter(readFileSync(path.join(sourceDir, filename), 'utf8'));
      const slug = filename.slice(0, -3), published = Date.parse(data.pubDate);
      if (!data.draft && Number.isFinite(published) && published <= Date.now()) posts.set(slug, { ...data, slug });
    }
  } catch (error) { db.close(); throw error; }
  return { root, dataDir, db, get, all, run, transaction, audit, publicPost(slug) { return posts.get(slug) || null; } };
}
