import { app } from 'electron';
import path from 'node:path';
import { DEFAULT_PORT, WS_PATH } from '@openflow/protocol/index.ts';
import { APPS } from '@openflow/desktop/apps.ts';
import { devUrl } from '@openflow/desktop/dev.ts';
import { scheme, serve } from '@openflow/desktop/serve.ts';
import { state } from '@openflow/desktop/state.ts';
import { updates } from '@openflow/desktop/update.ts';
import { lifecycle, open } from '@openflow/desktop/window.ts';

/**
 * set[flow]: the session manager, in a window of its own.
 *
 * It used to be a page the Max device served, which meant the device carried
 * 595 kB of base64 web app inside Live's process and the manager was open
 * whenever the device was. Both of those were the wrong way round: the device
 * should bridge Live and nothing else, and a set manager is something you open
 * when you are working on a set — deliberately, and not during a show.
 *
 * What is left in this file is what is only true of *this* app: where the device
 * is, and that the window is a file server over a build. The window itself, the
 * scheme, the dev loop and the updater are `@openflow/desktop`, shared with
 * every other app here — see `desktop/README.md`.
 */

const SET = APPS.set;
/** `set/dist`, from `set/electron/dist/main.cjs`. */
const DIST = path.resolve(__dirname, '..', '..', 'dist');

const PORT = Number(process.env.OPENFLOW_PORT) || DEFAULT_PORT;
const BRIDGE = process.env.OPENFLOW_BRIDGE_WS ?? `ws://127.0.0.1:${PORT}${WS_PATH}`;

const DEV = devUrl(SET);
/** Where the window opens, and the only address it is allowed to stay on. */
const HOME = DEV || `${SET.name}://app/`;

// Before anything can read it, which is the whole reason it is this early.
state(SET);
// And before `whenReady`, which is when a privileged scheme has to be declared.
scheme(SET);

const window = (): void => {
  open({
    app: SET,
    home: HOME,
    dev: DEV,
    bounds: true,
    retry: true,
    note: `bridge ${DEV ? 'through the dev server' : BRIDGE}`,
    // Nothing in dev, deliberately. `bridgeUrl()` then falls back to the origin
    // the page came from and vite's `/ws` proxy carries it to the device — which
    // is what a browser does, and what keeps a worktree pointed at whatever
    // device its own dev server was configured for instead of at whatever this
    // process guessed.
    args: [`--openflow-bridge=${DEV ? '' : BRIDGE}`],
  });
};

void app.whenReady().then(() => {
  serve(SET, DIST);
  window();
  updates(SET);
});

lifecycle(app, window);
