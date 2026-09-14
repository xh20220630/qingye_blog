import { createApp } from './app.mjs';

const app = createApp();
const port = Number(process.env.PORT || 4324);
app.server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`青野山房: http://127.0.0.1:${port}`);
  console.log(`持久数据: ${app.store.dataDir}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { app.close(); process.exit(0); });
