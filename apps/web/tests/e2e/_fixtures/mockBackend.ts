import { test as base, expect, type Page, type WebSocketRoute } from "@playwright/test";

export const ROOM_ID = "e2e-room-1";
export const PLAYER_ID = "e2e-player-1";
export const PLAYER_TOKEN = "e2e-token-xyz";

/**
 * Driver for the in-test fake GM backend. The Playwright Node side keeps a
 * reference to the live WebSocketRoute, so individual tests can push frames
 * to the page and inspect what the page sent back without needing a real
 * uvicorn process. Combat math and AI behaviour are out of scope — the
 * driver only replays scripted server frames in the order tests dictate.
 */
export class MockBackend {
  private route: WebSocketRoute | null = null;
  private resolveRoute: ((r: WebSocketRoute) => void) | null = null;
  private waitForRoute: Promise<WebSocketRoute>;
  readonly received: unknown[] = [];

  constructor() {
    this.waitForRoute = new Promise<WebSocketRoute>((resolve) => {
      this.resolveRoute = resolve;
    });
  }

  async install(page: Page): Promise<void> {
    await page.route("**/api/v1/rooms", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          room_id: ROOM_ID,
          master_token: "e2e-master-token",
          scenario_title: "E2E Scenario",
        }),
      });
    });

    await page.route("**/api/v1/rooms/*/join", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          player_id: PLAYER_ID,
          player_token: PLAYER_TOKEN,
          room_info: { room_id: ROOM_ID, title: "E2E Scenario" },
        }),
      });
    });

    await page.routeWebSocket(/\/room\//, (ws) => {
      // Keep frames from the page so tests can assert what the client sent.
      ws.onMessage((raw) => {
        try {
          this.received.push(JSON.parse(String(raw)));
        } catch {
          this.received.push(raw);
        }
      });
      this.route = ws;
      this.resolveRoute?.(ws);
    });
  }

  /** Wait for the page to actually open the WS connection. */
  async ready(): Promise<WebSocketRoute> {
    return this.waitForRoute;
  }

  /** Push a server frame to the page. Must be called after `ready()`. */
  send(frame: Record<string, unknown>): void {
    if (!this.route) {
      throw new Error("MockBackend.send called before client connected");
    }
    this.route.send(JSON.stringify(frame));
  }

  /** Drop the connection to simulate a disconnect/server crash. */
  closeSocket(code: number = 1006): void {
    this.route?.close({ code });
    this.route = null;
    // Reset the ready latch so a subsequent `await mock.ready()` waits for the
    // client's reconnection attempt to land.
    this.waitForRoute = new Promise<WebSocketRoute>((resolve) => {
      this.resolveRoute = resolve;
    });
  }

  /** Helper: sent frames whose `action` matches. */
  sentByAction(action: string): unknown[] {
    return this.received.filter(
      (m): m is Record<string, unknown> =>
        typeof m === "object" && m !== null && (m as { action?: unknown }).action === action,
    );
  }
}

interface E2EFixtures {
  mock: MockBackend;
}

export const test = base.extend<E2EFixtures>({
  mock: async ({ page }, use) => {
    const mock = new MockBackend();
    await mock.install(page);
    await use(mock);
  },
});

export { expect };
