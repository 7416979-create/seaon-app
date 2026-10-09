// Dev server in DEMO mode for screen checks: .env (live Supabase) is never loaded,
// so nothing here can touch real data. Usage: npm run dev:demo  → http://localhost:5174/seaon-app/
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emptyEnv = path.join(root, 'node_modules', '.demo-env');
mkdirSync(emptyEnv, { recursive: true });

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  envDir: emptyEnv,
  server: { port: 5174, strictPort: true, host: 'localhost' },
});
await server.listen();
server.printUrls();
