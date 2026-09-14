import { existsSync } from 'node:fs';
import path from 'node:path';

try {
  const home = path.join(process.env.QY_STATIC_DIR || '/app/dist', 'index.html');
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 4324}/api/health`, { signal: AbortSignal.timeout(3000) });
  const healthy = existsSync(home) && response.ok && (await response.json()).ok === true;
  process.exit(healthy ? 0 : 1);
} catch { process.exit(1); }
