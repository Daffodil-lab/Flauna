import { test, expect, stubApiForRoom } from "./_helpers";
import { installVersionMismatchScenario } from "../fixtures/scenarios/edge_version_mismatch";

test.describe("§12-4 Phase 9 edge: VERSION_MISMATCH auto-resend", () => {
  test("client recovers after the server rejects the first turn submission", async ({
    page,
    mockServer,
  }) => {
    installVersionMismatchScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    // The chat input drives the same submit_turn_action path the scenario
    // listens for; this keeps the spec stable across UI iterations.
    await page.getByTestId("chatpanel-input").fill("攻撃する");
    await page.getByTestId("chatpanel-send").click();

    // After the first VERSION_MISMATCH + resend, the second submit produces a
    // narrative; assert that it lands eventually.
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=再送が受理"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
