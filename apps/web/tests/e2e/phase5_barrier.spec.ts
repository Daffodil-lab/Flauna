import { test, expect, gotoSmokeRoom } from "./_helpers";

test.describe("§12-4 Phase 5: barrier flow", () => {
  test("server-pushed gm_narrative for the barrier reaches the chat log", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);
    mockServer.broadcast({
      type: "gm_narrative",
      event_id: 9201,
      timestamp: new Date().toISOString(),
      text: "結界が編まれ、淡い光が空間を覆った。",
      is_streaming: false,
    });
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=結界が編まれ"),
    ).toBeVisible({ timeout: 5000 });
  });
});
