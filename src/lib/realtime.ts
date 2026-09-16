/**
 * Process-wide event bus backed by Postgres LISTEN/NOTIFY, so several app
 * instances stay in sync. Payloads are small invalidation messages (ids
 * and paths), never document bodies — NOTIFY caps payloads at 8000 bytes.
 */
import postgres from "postgres";

export type RtEvent =
  | { type: "doc"; path: string; collection: string; deleted?: boolean }
  | { type: "presence" }
  | { type: "room"; id: number }
  | { type: "version"; versionId: string; number: number }
  | { type: "comments" }
  | { type: "meta" }
  | { type: "deleted" };

type Handler = (event: RtEvent) => void;

const CHANNEL = "artifacts_rt";

class Bus {
  private handlers = new Map<string, Set<Handler>>();
  private listener: ReturnType<typeof postgres> | null = null;
  private listening: Promise<void> | null = null;

  private async ensureListening() {
    if (this.listening) return this.listening;
    this.listening = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      this.listener = postgres(url, { max: 1, idle_timeout: 0 });
      await this.listener.listen(CHANNEL, (raw) => {
        try {
          const { a, e } = JSON.parse(raw) as { a: string; e: RtEvent };
          this.dispatchLocal(a, e);
        } catch {
          /* ignore malformed */
        }
      });
    })();
    return this.listening;
  }

  private dispatchLocal(artifactId: string, event: RtEvent) {
    const set = this.handlers.get(artifactId);
    if (!set) return;
    for (const h of set) {
      try {
        h(event);
      } catch {
        /* handler errors never break the bus */
      }
    }
  }

  async subscribe(artifactId: string, handler: Handler): Promise<() => void> {
    await this.ensureListening();
    let set = this.handlers.get(artifactId);
    if (!set) {
      set = new Set();
      this.handlers.set(artifactId, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.handlers.delete(artifactId);
    };
  }

  /** Publish through Postgres so every instance (this one included) hears it. */
  async publish(artifactId: string, event: RtEvent) {
    await this.ensureListening();
    const payload = JSON.stringify({ a: artifactId, e: event });
    await this.listener!.notify(CHANNEL, payload);
  }
}

const g = globalThis as unknown as { __artifactsBus?: Bus };
export const bus = g.__artifactsBus ?? new Bus();
if (process.env.NODE_ENV !== "production") g.__artifactsBus = bus;

export function publish(artifactId: string, event: RtEvent) {
  // Fire-and-forget: realtime delivery must never fail a write.
  bus.publish(artifactId, event).catch((err) => console.error("[realtime] publish failed", err));
}
