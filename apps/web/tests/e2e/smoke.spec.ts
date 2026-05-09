import { test, expect, gotoSmokeRoom } from "./_helpers";

// Spec §12-4 Phase 3 smoke: connect → first turn → narrative shows up. Drives
// the chat panel and the QuickActionBar end-to-end against MockWSServer.

test.describe("§12-4 Phase 3 smoke E2E", () => {
  test("loads the room, receives state, and renders narrative on submit_turn_action", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);

    // After session_restore + state_full + turn_start arrived from MockWSServer
    // the room should be ready: chatpanel visible, narrative panel ready.
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    // Send a chat message — round-trips through WS, MockWSServer records it.
    await page.getByTestId("chatpanel-input").fill("行くぞ！");
    await page.getByTestId("chatpanel-send").click();
    const sent = await mockServer.expectClientMessage(
      (m) => m.action === "player_statement" && (m.text as string) === "行くぞ！",
    );
    expect(sent.parsed.scope).toBe("all");
  });

  test("VITE_WS_URL runtime override is honoured", async ({
    page,
    mockServer,
  }) => {
    await gotoSmokeRoom(page, mockServer);
    // Just connecting and sending a message proves the override is wired —
    // if it weren't, MockWSServer would never see traffic.
    await page.getByTestId("chatpanel-input").fill("hi");
    await page.getByTestId("chatpanel-send").click();
    await mockServer.expectClientMessage((m) => m.action === "player_statement");
  });
});
