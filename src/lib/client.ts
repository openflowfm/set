// Typed WebSocket client for the bridge. Framework-free.
//
// Requests carry an id so replies can be correlated; `request()` resolves with
// the terminal event for that id. Non-terminal traffic (progress, structural
// change notifications) goes to subscribers instead.

import { bridgeUrl } from './bridgeUrl.ts';

export type BridgeEvent = OpenFlow.Event;
type Listener = (event: BridgeEvent) => void;

/** The event that completes each request type. */
const TERMINAL = {
  snapshot: 'snapshot',
  apply: 'applied',
  addScenes: 'scenesAdded',
  move: 'moved',
  moveClips: 'clipsMoved',
  palette: 'palette',
  clipNotes: 'clipNotes',
  saveSetConfig: 'setConfigSaved',
  saveAllowedColors: 'allowedColorsSaved',
  ping: 'pong',
} as const satisfies Partial<Record<OpenFlow.RequestType, OpenFlow.EventType>>;

type Awaitable = keyof typeof TERMINAL;

/** Requests that produce a terminal reply, i.e. everything `request()` accepts. */
type AwaitableRequest = Extract<OpenFlow.Request, { type: Awaitable }>;

interface Waiter {
  expect: OpenFlow.EventType;
  resolve: (e: BridgeEvent) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  sentAt: number;
}

/** Costs only the client can see: the wire and the parse. */
export interface WireTiming {
  /** Send → terminal reply, ms. Everything the user actually waits for. */
  totalMs: number;
  /** JSON.parse of the reply, ms. */
  parseMs: number;
  /** Reply size in bytes. */
  bytes: number;
}

export type ConnectionState = 'connecting' | 'open' | 'closed';

export class BridgeClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly waiters = new Map<number, Waiter>();
  private readonly listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closedByUs = false;

  state: ConnectionState = 'connecting';
  lomReady = false;
  /** Wire cost of the most recent terminal reply. */
  lastWireTiming: WireTiming | null = null;

  constructor(private readonly url = bridgeUrl()) {}

  connect(): void {
    this.closedByUs = false;
    this.setState('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      // First thing on the socket, so the device's roster lights this app's row
      // rather than counting it as one more anonymous connection. Nothing waits
      // on it and nothing is served differently for having sent it.
      ws.send(JSON.stringify({ type: 'identify', client: 'set' } satisfies OpenFlow.Request));
      this.setState('open');
    };

    ws.onclose = () => {
      this.lomReady = false;
      this.setState('closed');
      this.failAll('socket closed');
      if (!this.closedByUs) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 1000);
      }
    };

    // A socket error is always followed by close; reconnect is handled there.
    ws.onerror = () => {};

    ws.onmessage = (ev) => {
      const arrivedAt = performance.now();
      const raw = String(ev.data);
      let event: BridgeEvent;
      const beforeParse = performance.now();
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      const parseMs = performance.now() - beforeParse;
      if (event.type === 'status') this.lomReady = event.lomReady;

      const id = 'id' in event ? event.id : undefined;
      if (id !== undefined) {
        const waiter = this.waiters.get(id);
        if (waiter && (event.type === waiter.expect || event.type === 'error')) {
          this.waiters.delete(id);
          clearTimeout(waiter.timer);
          // Read synchronously right after the await that this resolves; UI
          // requests are serialized behind a busy flag so they can't interleave.
          this.lastWireTiming = {
            totalMs: arrivedAt - waiter.sentAt,
            parseMs,
            bytes: new Blob([raw]).size,
          };
          // `||`: a blank message is as useless as a missing one, and naming the
          // request at least says which call died.
          if (event.type === 'error') {
            waiter.reject(
              new Error(event.message || `${waiter.expect} request failed with no message`),
            );
          }
          else waiter.resolve(event);
        }
      }
      this.emit(event);
    };
  }

  close(): void {
    this.closedByUs = true;
    clearTimeout(this.reconnectTimer);
    this.failAll('client closed');
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    if (ws.readyState === WebSocket.CONNECTING) {
      // Closing a socket mid-handshake aborts the upgrade, and through Vite's
      // dev proxy that surfaces as `write EPIPE` in the dev server log — the
      // proxy is still writing the 101 to a socket the browser has dropped.
      // StrictMode does connect-then-close on every mount, so wait for the
      // handshake and close cleanly. The handlers are detached first: this
      // socket is already superseded and must not touch shared state.
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = () => {};
      ws.onopen = () => ws.close();
      return;
    }
    ws.close();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Fire and forget. */
  send(request: OpenFlow.Request): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(request));
  }

  /** Send and await the terminal event for this request. */
  request<R extends AwaitableRequest>(
    request: R,
    timeoutMs = 120_000,
  ): Promise<OpenFlow.EventOf<(typeof TERMINAL)[R['type']]>> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'));
    }
    const id = this.nextId++;
    const expect: OpenFlow.EventType = TERMINAL[request.type];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error(`${request.type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiters.set(id, {
        expect,
        resolve: resolve as Waiter['resolve'],
        reject,
        timer,
        sentAt: performance.now(),
      });
      this.ws!.send(JSON.stringify({ ...request, id }));
    });
  }

  private emit(event: BridgeEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  private setState(s: ConnectionState): void {
    this.state = s;
    this.emit({ type: 'status', lomReady: this.lomReady });
  }

  private failAll(reason: string): void {
    for (const [, w] of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error(reason));
    }
    this.waiters.clear();
  }
}
