import { test, expect, stubApiForRoom } from "./_helpers";
import { installBarrierScenario } from "../fixtures/scenarios/barrier_flow";

test.describe("§12-4 Phase 5: barrier flow", () => {
  test("renders narrative after pillar/wire updates arrive", async ({
    page,
    mockServer,
  }) => {
    installBarrierScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    await page.getByTestId("chatpanel-input").fill("結界を張る");
    await page.getByTestId("chatpanel-send").click();

    // The scenario emits a final gm_narrative once the pillar/wire patches
    // have been applied; wait for the text to surface in the chat log.
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=結界が編まれ"),
    ).toBeVisible({ timeout: 5000 });
  });
});
