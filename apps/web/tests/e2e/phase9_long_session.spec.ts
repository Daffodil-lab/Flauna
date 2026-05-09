import { test, expect, gotoSmokeRoom } from "./_helpers";

test.describe("§12-4 Phase 9: long-session smoke", () => {
  test.setTimeout(60_000);
  test.describe.configure({ retries: 0 });

  test("client digests 30 server-pushed narratives without de-mounting the chat panel", async ({
    page,
    mockServer,
  }) => {
    const TURNS = 30;
    await gotoSmokeRoom(page, mockServer);

    for (let i = 0; i < TURNS; i++) {
      mockServer.broadcast({
        type: "gm_narrative",
        event_id: 10_000 + i,
        timestamp: new Date().toISOString(),
        text: `PHASE9_TURN_${i}`,
        is_streaming: false,
      });
    }
    // Assert the last entry made it to the panel — proxy for "didn't drop".
    await expect(
      page.locator(`[data-testid='chatpanel'] >> text=PHASE9_TURN_${TURNS - 1}`),
    ).toBeVisible({ timeout: 10_000 });
  });
});
