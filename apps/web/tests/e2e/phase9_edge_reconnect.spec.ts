import { test, expect, stubApiForRoom } from "./_helpers";
import { installReconnectScenario } from "../fixtures/scenarios/edge_reconnect";

test.describe("§12-4 Phase 9 edge: reconnect", () => {
  test.setTimeout(60_000);

  test("client survives a forced WS drop and re-renders state", async ({
    page,
    mockServer,
  }) => {
    const handle = installReconnectScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    // Force the client into a reconnect by stopping and restarting the mock.
    await mockServer.stop();
    handle.drop();
    await mockServer.start(
      Number(new URL(mockServer.url().replace("ws://", "http://")).port) || 0,
    );
    // After restart the client's auto-retry loop should reconnect within a few
    // seconds; we don't assert a specific narrative here, only that the chat
    // panel is still present and operable.
    await expect(page.getByTestId("chatpanel-input")).toBeEnabled({
      timeout: 15_000,
    });
  });
});
