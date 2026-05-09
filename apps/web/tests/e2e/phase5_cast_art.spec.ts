import { test, expect } from "./_helpers";
import { installCastArtScenario } from "../fixtures/scenarios/cast_art_flow";
import { stubApiForRoom } from "./_helpers";

test.describe("§12-4 Phase 5: cast-art cutscene", () => {
  test("cutscene appears on art_cast and dismisses on its own", async ({
    page,
    mockServer,
  }) => {
    installCastArtScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    // Send a chat message to trigger the scenario response (the scenario
    // handler tied to submit_turn_action). Smoke-style: use the chat path so
    // we don't depend on the QuickActionBar being mid-turn-aware in this
    // synthetic setup.
    await page.getByTestId("chatpanel-input").fill("祓魔術を放つ");
    await page.getByTestId("chatpanel-send").click();
    // The cutscene rides on the art_cast event — the scenario emits it on
    // any submit_turn_action; here we trigger via the chat scope to keep the
    // smoke deterministic. In the real product this is wired via CastArtModal.
    // Either entry point exercises CastArtCutscene end-to-end.
    // To force an art_cast we manually broadcast from MockWSServer:
    mockServer.broadcast({
      type: "event",
      event_id: 999,
      timestamp: new Date().toISOString(),
      event_name: "art_cast",
      payload: { art_name: "霊弾発射", caster_id: "char-pc" },
    });
    const overlay = page.getByTestId("cast-art-cutscene");
    await expect(overlay).toBeVisible({ timeout: 5000 });
    // Cutscene total duration is ~1800ms — wait for it to dismiss.
    await expect(overlay).toBeHidden({ timeout: 5000 });
  });
});
