import { test, expect, stubApiForRoom } from "./_helpers";
import { installMultiPlayerScenario } from "../fixtures/scenarios/multi_player";

test.describe("§12-4 Phase 5: multi-player chat broadcast", () => {
  test("two browser contexts see each other's chat messages", async ({
    browser,
    mockServer,
  }) => {
    installMultiPlayerScenario(mockServer);

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    for (const [page, who] of [
      [page1, "player-1"],
      [page2, "player-2"],
    ] as const) {
      await stubApiForRoom(page, { playerId: who });
      await page.addInitScript(
        ({ wsUrl, playerId }) => {
          const g = globalThis as Record<string, unknown>;
          g.__VITE_WS_URL__ = wsUrl;
          window.localStorage.setItem("flauna.playerName", playerId);
        },
        { wsUrl: mockServer.url(), playerId: who },
      );
      await page.goto("/room/room-test");
      await expect(page.getByTestId("chatpanel")).toBeVisible();
    }

    await page1.getByTestId("chatpanel-input").fill("行くぞ");
    await page1.getByTestId("chatpanel-send").click();

    // Both pages should see the rebroadcast narrative.
    await expect(
      page1.locator("[data-testid='chatpanel'] >> text=行くぞ"),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page2.locator("[data-testid='chatpanel'] >> text=行くぞ"),
    ).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
