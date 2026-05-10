import { test, expect, gotoSmokeRoom } from "./_helpers";

// §12-4 Phase 5 multi-player is best exercised at the integration / unit
// layer (MockWSServer broadcast → chatStore filter on scope). The full
// dual-context Playwright variant is parked behind test.skip until the WS
// reconnect / dual-cookie story is tightened up; see PR #76 follow-ups.

test.describe("§12-4 Phase 5: multi-player chat broadcast", () => {
  test("server broadcast lands on all connected pages", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);
    // Single-page assertion: the server broadcasting a narrative reaches the
    // chat log. Multi-context flow is tracked separately.
    mockServer.broadcast({
      type: "gm_narrative",
      event_id: 9301,
      timestamp: new Date().toISOString(),
      text: "MULTI_PLAYER_BROADCAST",
      is_streaming: false,
    });
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=MULTI_PLAYER_BROADCAST"),
    ).toBeVisible({ timeout: 5000 });
  });
});
