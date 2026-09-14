import { readFileSync } from 'node:fs';
import { openStore, assert, passwordHash } from './core.mjs';

const [command, username, passwordFile] = process.argv.slice(2);
assert(command === 'reset' && username && passwordFile, 400, '用法: node --env-file-if-exists=.env server/accounts.mjs reset 用户名 私有密码文件路径');
const store = openStore();
try {
  const user = store.get('SELECT * FROM users WHERE username=?', username);
  assert(user, 404, '用户不存在');
  const hash = await passwordHash(readFileSync(passwordFile, 'utf8').trim());
  store.transaction(() => { store.run('UPDATE users SET password=? WHERE id=?', hash, user.id); store.run('DELETE FROM sessions WHERE user_id=?', user.id); store.audit(null, 'account.password-reset', user.id); });
  console.log(`已重置 ${username} 的密码并退出该账号的全部会话。`);
} finally { store.db.close(); }
