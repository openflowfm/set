import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The device bench. Faces are composed here rather than in `widgets/`, so they
// need a harness here too — the widget bench may not import this module, and a
// face drawn only inside the app can't be looked at without Live.
//
// Never built, like the widget bench: no `outDir`, nothing in `bench/` ships.
//
// The port follows set[flow]'s the way the widget bench's does, at +200 rather
// than +100 so the two benches of one worktree can't collide with the app of
// the next — worktree ports get picked adjacently.
const SET_PORT = Number(process.env.OPENFLOW_PORT_BASE) || 5173;
const PORT = Number(process.env.OPENFLOW_DEVICE_BENCH_PORT) || SET_PORT + 200;

export default defineConfig({
  root: path.resolve(here, 'bench'),
  plugins: [react()],
  // Named for the same reason the other two are: three Vite servers sharing one
  // dep cache each decide the others' is stale and re-optimize on every start.
  cacheDir: path.resolve(here, 'node_modules/.vite/devices'),
  server: {
    port: PORT,
    strictPort: true,
    // The bench reaches up into `src` for the faces, so the root is the repo.
    fs: { allow: [here] },
  },
});
