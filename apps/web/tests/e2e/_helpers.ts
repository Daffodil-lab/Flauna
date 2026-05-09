import { test as base, expect, type Page } from "@playwright/test";
import { MockWSServer } from "../fixtures/mock_ws_server";
import { installSmokeOneTurnScenario } from "../fixtures/scenarios/smoke_one_turn";

// Custom Playwright fixture that boots a MockWSServer per test, exposes its
// dynamic port via window.__VITE_WS_URL__, and tears down on teardown. Tests
// then call goto() on the room URL to exercise the full WebSocket pipeline.

export type TacexFixtures = {
  mockServer: MockWSServer;
};

export const test = base.extend<TacexFixtures>({
  mockServer: async ({}, use) => {
    const server = new MockWSServer();
    await server.start(0);
    await use(server);
    await server.stop();
  },
});

export { expect };

/**
 * Stub the /api/v1 surface so the page can join a room without a real GM
 * backend. The MockWSServer covers everything once the WebSocket opens.
 */
export async function stubApiForRoom(
  page: Page,
  opts: { roomId?: string; playerId?: string } = {},
): Promise<void> {
  const roomId = opts.roomId ?? "room-test";
  const playerId = opts.playerId ?? "player-me";
  await page.route("**/api/v1/rooms/*/join", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        player_id: playerId,
        player_token: "token-test",
        room_info: { room_id: roomId, title: "First Mission" },
      }),
    });
  });
}

/**
 * Boot a smoke scenario and navigate the page directly into a room. Returns
 * once the chat panel is visible (proxy for "session restored").
 */
export async function gotoSmokeRoom(
  page: Page,
  server: MockWSServer,
  roomId = "room-test",
): Promise<void> {
  installSmokeOneTurnScenario(server);
  await stubApiForRoom(page, { roomId });
  // Inject the WS URL before any app code runs so the websocket layer reads it.
  await page.addInitScript((wsUrl) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    // Pre-fill the lobby state Room.tsx expects (sessionStorage path).
    window.localStorage.setItem("flauna.playerName", "アリス");
  }, server.url());
  await page.goto(`/room/${roomId}`);
  await expect(page.getByTestId("chatpanel")).toBeVisible({ timeout: 15_000 });
}
