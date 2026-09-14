import { backup } from 'node:sqlite';
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { openStore, atomicWrite } from './core.mjs';

const store = openStore();
const destination = path.join(store.dataDir, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(destination, { recursive: true });
try {
  await backup(store.db, path.join(destination, 'blog.sqlite'));
  cpSync(path.join(store.dataDir, 'media'), path.join(destination, 'media'), { recursive: true });
  cpSync(path.join(store.root, 'src', 'content', 'blog'), path.join(destination, 'blog'), { recursive: true });
  cpSync(path.join(store.root, 'src', 'site-settings.json'), path.join(destination, 'site-settings.json'));
  atomicWrite(path.join(destination, 'manifest.json'), JSON.stringify({ format: 'qingye-full-backup-v1', created: new Date().toISOString(), node: process.version }, null, 2));
  console.log(`完整备份已保存: ${destination}`);
} finally { store.db.close(); }
