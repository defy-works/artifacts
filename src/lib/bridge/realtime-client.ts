"use client";

/**
 * One EventSource per open artifact, shared by the viewer chrome and the
 * capability bridge. The browser reconnects on its own; connection state
 * is reported so the room can show it.
 */
export type RtHandler = (data: any) => void;

const EVENTS = ["hello", "doc", "peers", "room", "version", "comments", "meta", "deleted", "ping"];

export class RealtimeClient {
  private es: EventSource | null = null;
  private handlers = new Map<string, Set<RtHandler>>();
  private connHandlers = new Set<(c: boolean) => void>();
  private _connected = false;
  readonly url: string;

  constructor(slug: string) {
    this.url = `/api/v1/artifacts/${encodeURIComponent(slug)}/events`;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this.es) return;
    const es = new EventSource(this.url, { withCredentials: true });
    this.es = es;
    for (const name of EVENTS) {
      es.addEventListener(name, (ev) => {
        let data: unknown = null;
        try {
          data = JSON.parse((ev as MessageEvent).data);
        } catch {
          return;
        }
        if (name === "hello") this.setConnected(true);
        this.handlers.get(name)?.forEach((h) => {
          try {
            h(data);
          } catch (err) {
            console.error(err);
          }
        });
      });
    }
    es.onopen = () => this.setConnected(true);
    es.onerror = () => this.setConnected(false);
  }

  private setConnected(c: boolean) {
    if (this._connected === c) return;
    this._connected = c;
    this.connHandlers.forEach((h) => h(c));
  }

  on(event: string, handler: RtHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  }

  onConnection(handler: (c: boolean) => void): () => void {
    this.connHandlers.add(handler);
    return () => {
      this.connHandlers.delete(handler);
    };
  }

  close() {
    this.es?.close();
    this.es = null;
    this.setConnected(false);
  }
}
