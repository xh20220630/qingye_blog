import { pathToFileURL } from 'node:url';
import { openStore, assert } from './core.mjs';

export function reviewComments(store, action, ids = []) {
  if (action === 'pending') return store.all("SELECT id,thread,name,body,created FROM comments WHERE status='pending' ORDER BY id");
  const status = { approve: 'approved', hide: 'hidden', spam: 'spam' }[action];
  assert(status && ids.length && ids.every(id => Number.isSafeInteger(id) && id > 0), 400, '用法: node server/comments.mjs pending | approve/hide/spam 留言编号...');
  return store.transaction(() => {
    for (const id of ids) {
      assert(store.get('SELECT id FROM comments WHERE id=?', id), 404, `留言 #${id} 不存在`);
      store.run('UPDATE comments SET status=? WHERE id=?', status, id);
      store.audit(null, `comment.${action}`, id);
    }
    return { updated: ids.length, status };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = openStore();
  try { console.log(JSON.stringify(reviewComments(store, process.argv[2], process.argv.slice(3).map(Number)), null, 2)); }
  finally { store.db.close(); }
}
