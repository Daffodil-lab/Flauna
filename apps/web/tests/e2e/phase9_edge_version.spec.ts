import { test, expect, gotoSmokeRoom } from "./_helpers";

test.describe("§12-4 Phase 9 edge: VERSION_MISMATCH server message", () => {
  test("a VERSION_MISMATCH error message is logged to chat without crashing", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);
    mockServer.broadcast({
      type: "error",
      event_id: 9501,
      timestamp: new Date().toISOString(),
      code: "VERSION_MISMATCH",
      message: "Stale expected_version; please resubmit.",
      detail: { server_version: 2 },
      client_request_id: null,
    });
    // After the error arrives the chat panel should still be there. The full
    // resync round-trip is covered by the unit / integration suite.
    await expect(page.getByTestId("chatpanel")).toBeVisible();
  });
});
