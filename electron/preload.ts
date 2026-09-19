import { expose, flag } from '@openflow/desktop/preload.ts';

/**
 * The one fact the renderer cannot work out for itself: where the device is.
 *
 * Nothing else is exposed. The app speaks one protocol over one socket and has
 * no business reaching the filesystem or the shell; `contextIsolation` is only
 * worth having if what crosses it stays this small. How the string gets here,
 * and why it is a flag rather than an environment variable, is in
 * `@openflow/desktop/preload.ts`.
 */
expose({ bridge: flag('bridge') });
