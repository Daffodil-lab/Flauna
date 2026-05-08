import {
  test as base,
  expect,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

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
  private resolveJoin: (() => void) | null = null;
  private waitForJoin: Promise<void>;
  readonly received: unknown[] = [];

  constructor() {
    this.waitForJoin = new Promise<void>((resolve) => {
      this.resolveJoin = resolve;
    });
  }

  async install(page: Page): Promise<void> {
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        // eslint-disable-next-line no-console
        console.log(`[browser ${msg.type()}]`, msg.text());
      }
    });
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.log("[browser pageerror]", err.message);
    });

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

    await page.routeWebSocket(
      (url) => url.pathname.startsWith("/room/"),
      (ws) => {
        ws.onMessage((raw) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(String(raw));
          } catch {
            parsed = raw;
          }
          this.received.push(parsed);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            (parsed as { action?: unknown }).action === "join_room"
          ) {
            this.resolveJoin?.();
          }
        });
        this.route = ws;
      },
    );
  }

  /** Wait for the page to actually open the WS connection AND finish the
   *  client-side handshake by sending its `join_room` frame. Sending mock
   *  frames before this point races against the page's onopen handler. */
  async ready(): Promise<void> {
    await this.waitForJoin;
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
    this.waitForJoin = new Promise<void>((resolve) => {
      this.resolveJoin = resolve;
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
