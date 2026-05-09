import { test, expect, gotoSmokeRoom } from "./_helpers";

// Spec §12-4 Phase 3 smoke: connect → first turn → narrative shows up. Drives
// the chat panel and asserts via server-pushed messages so the test does not
// depend on input-fill flakiness inside Konva-shaped React trees.

test.describe("§12-4 Phase 3 smoke E2E", () => {
  test("loads the room and renders a server-pushed narrative", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);

    // After session_restore + state_full + turn_start arrive, the session
    // status is ACTIVE and a system "Session restored" entry is logged.
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    // Server-side narrative — no client interaction required.
    mockServer.broadcast({
      type: "gm_narrative",
      event_id: 9001,
      timestamp: new Date().toISOString(),
      text: "SMOKE_NARRATIVE",
      is_streaming: false,
    });
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=SMOKE_NARRATIVE"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("VITE_WS_URL runtime override is honoured", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);
    // gotoSmokeRoom already waited for chatpanel to mount, which only happens
    // if MockWSServer received join_room — that proves the override is wired.
    await mockServer.expectClientMessage((m) => m.action === "join_room");
  });
});
