import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "net";

// Spec §12-3: lightweight WS server backing both vitest integration tests and
// Playwright e2e specs. We avoid MSW so the real `WebSocket` constructor is
// exercised end-to-end, matching production behaviour.

type AnyClientMessage = Record<string, unknown>;
type AnyServerMessage = Record<string, unknown>;

export interface ClientMessageRecord {
  raw: string;
  parsed: AnyClientMessage;
  receivedAt: number;
}

export class MockWSServer {
  private wss: WebSocketServer | null = null;
  private connections = new Set<WebSocket>();
  private received: ClientMessageRecord[] = [];
  private autoReplyHandler:
    | ((msg: AnyClientMessage, send: (m: AnyServerMessage) => void) => void)
    | null = null;

  /**
   * Start the server. Pass 0 to receive a kernel-assigned port, then call
   * `port()` to read it. Returns a promise that resolves once the server is
   * ready to accept connections.
   */
  start(port = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port });
        this.wss.on("connection", (ws) => {
          this.connections.add(ws);
          ws.on("message", (data) => {
            const raw = data.toString();
            let parsed: AnyClientMessage = {};
            try {
              parsed = JSON.parse(raw) as AnyClientMessage;
            } catch {
              parsed = { __unparsable: raw };
            }
            this.received.push({ raw, parsed, receivedAt: Date.now() });
            this.autoReplyHandler?.(parsed, (m) => ws.send(JSON.stringify(m)));
          });
          ws.on("close", () => {
            this.connections.delete(ws);
          });
        });
        this.wss.on("listening", () => {
          const address = this.wss!.address() as AddressInfo;
          resolve(address.port);
        });
        this.wss.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  port(): number {
    if (!this.wss) throw new Error("MockWSServer not started");
    const a = this.wss.address() as AddressInfo;
    return a.port;
  }

  url(): string {
    return `ws://localhost:${this.port()}`;
  }

  /** Broadcast a server message to every connected client. */
  broadcast(msg: AnyServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  /**
   * Register an auto-reply handler. The function receives every client
   * message and a `send` callback to push back to that specific connection.
   * Useful for scripted scenarios (smoke flow, edge cases).
   */
  onMessage(
    handler: (
      msg: AnyClientMessage,
      send: (m: AnyServerMessage) => void,
    ) => void,
  ): void {
    this.autoReplyHandler = handler;
  }

  /** Replay a fixed sequence of server messages on every new connection. */
  replayScenario(events: AnyServerMessage[]): void {
    this.onMessage((_msg, send) => {
      for (const ev of events) send(ev);
    });
  }

  /** Drop all received-message history (useful between assertions). */
  clearReceived(): void {
    this.received = [];
  }

  /**
   * Wait until a client message matches the predicate, with a timeout. Returns
   * the matched record so tests can drill in further. Throws on timeout.
   */
  async expectClientMessage(
    predicate: (msg: AnyClientMessage) => boolean,
    timeoutMs = 5000,
  ): Promise<ClientMessageRecord> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hit = this.received.find((r) => predicate(r.parsed));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(
      `MockWSServer.expectClientMessage timed out after ${timeoutMs}ms; ` +
        `received ${this.received.length} message(s).`,
    );
  }

  receivedMessages(): ReadonlyArray<ClientMessageRecord> {
    return this.received;
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    for (const ws of this.connections) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    await new Promise<void>((resolve, reject) => {
      this.wss!.close((err) => (err ? reject(err) : resolve()));
    });
    this.wss = null;
    this.connections.clear();
    this.received = [];
    this.autoReplyHandler = null;
  }
}
