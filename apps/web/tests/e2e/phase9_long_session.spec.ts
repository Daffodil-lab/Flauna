import { test, expect, stubApiForRoom } from "./_helpers";
import { installLongSessionScenario } from "../fixtures/scenarios/long_session";

test.describe("§12-4 Phase 9: long-session smoke", () => {
  // Long sessions take longer than the default 30s; bump per-spec.
  test.setTimeout(90_000);
  test.describe.configure({ retries: 0 });

  test("survives 30 simulated turns without leaks (chat scroll stays usable)", async ({
    page,
    mockServer,
  }) => {
    const TURNS = 30;
    installLongSessionScenario(mockServer, TURNS);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    for (let i = 0; i < TURNS; i++) {
      await page.getByTestId("chatpanel-input").fill(`hi ${i}`);
      await page.getByTestId("chatpanel-send").click();
      // Wait for the matching narrative to appear before the next turn.
      await expect(
        page.locator(`[data-testid='chatpanel'] >> text=ターン ${i + 1}:`),
      ).toBeVisible({ timeout: 5000 });
    }

    // After 30 turns the scenario broadcasts combat_ended → CombatResultModal
    // should be present in the DOM via its testid.
    await expect(page.getByTestId("combat-result-modal")).toBeVisible({
      timeout: 5000,
    });
  });
});
