import { test, expect, gotoSmokeRoom } from "./_helpers";

test.describe("§12-4 Phase 5: cast-art cutscene", () => {
  test("cutscene appears on art_cast and dismisses on its own", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);

    // The smoke scenario state has char-pc; broadcast an art_cast event from
    // the server and assert the cutscene overlay surfaces. Avoids relying on
    // chat-input round trips so the test is stable against StrictMode-shaped
    // re-renders.
    mockServer.broadcast({
      type: "event",
      event_id: 9101,
      timestamp: new Date().toISOString(),
      event_name: "art_cast",
      payload: { art_name: "霊弾発射", caster_id: "char-pc" },
    });
    const overlay = page.getByTestId("cast-art-cutscene");
    await expect(overlay).toBeVisible({ timeout: 5000 });
    // Total duration is ~1800 ms (enter 200 / hold 1400 / exit 200).
    await expect(overlay).toBeHidden({ timeout: 5000 });
  });
});
