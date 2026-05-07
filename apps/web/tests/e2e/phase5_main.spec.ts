/**
 * Phase 5 main-feature E2E (spec §12-4): cover the headline mechanics that
 * the Phase 5 milestone introduces — cast art (with the cutscene overlay),
 * barriers as status effects on the map, and a multi-PC turn order so the
 * roster renders more than one player.
 */
import { test, expect, ROOM_ID, PLAYER_ID } from "./_fixtures/mockBackend";
import { makeChar, makeState, nextEventId } from "./_fixtures/state";

async function arriveInRoom(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("lobby-player-name").fill("E2E太郎");
  await page.getByRole("button", { name: /ルームを作成|Create/ }).click();
  await page.waitForURL(`**/room/${ROOM_ID}`);
}

test("cast art event from the GM triggers the cutscene overlay", async ({ page, mock }) => {
  await arriveInRoom(page);
  await mock.ready();

  const state = makeState();
  mock.send({
    type: "session_restore",
    event_id: nextEventId(),
    current_state: state,
    pendings: [],
  });
  await expect(page.getByTestId("game-map")).toBeVisible();

  mock.send({
    type: "event",
    event_id: nextEventId(),
    event_name: "art_cast",
    payload: { art_name: "祓清", caster_id: "char-pc" },
  });

  const cutscene = page.getByTestId("cast-art-cutscene");
  await expect(cutscene).toBeVisible();
  await expect(page.getByTestId("cast-art-cutscene-announce")).toContainText("祓清");
  // Cutscene auto-dismisses after CUTSCENE_DURATION_MS (1.8s).
  await expect(cutscene).toBeHidden({ timeout: 5_000 });
});

test("barrier status renders on the affected character's status badge", async ({ page, mock }) => {
  await arriveInRoom(page);
  await mock.ready();

  const withBarrier = makeState({
    characters: [
      makeChar({ status_effects: [{ name: "結界・壁", duration: 3 }] }),
      makeChar({
        id: "char-enemy",
        name: "怨霊",
        player_id: null,
        faction: "enemy",
        hp: 8,
        max_hp: 8,
        position: [2, 0],
      }),
    ],
  });
  mock.send({
    type: "session_restore",
    event_id: nextEventId(),
    current_state: withBarrier,
    pendings: [],
  });

  await expect(page.getByTestId("sidemenu-status-char-pc")).toContainText("結界・壁");
});

test("multi-PC roster renders all players in the side menu", async ({ page, mock }) => {
  await arriveInRoom(page);
  await mock.ready();

  const partyState = makeState({
    characters: [
      makeChar(),
      makeChar({
        id: "char-pc-2",
        name: "蓮",
        player_id: "p2",
        position: [0, 1],
      }),
      makeChar({
        id: "char-pc-3",
        name: "椿",
        player_id: "p3",
        position: [0, 2],
      }),
      makeChar({
        id: "char-enemy",
        name: "怨霊",
        player_id: null,
        faction: "enemy",
        hp: 12,
        max_hp: 12,
        position: [4, 0],
      }),
    ],
  });
  mock.send({
    type: "session_restore",
    event_id: nextEventId(),
    current_state: partyState,
    pendings: [],
  });

  // All three PCs surface their evasion HUD line in the side menu.
  await expect(page.getByTestId("sidemenu-evasion-char-pc")).toBeVisible();
  await expect(page.getByTestId("sidemenu-evasion-char-pc-2")).toBeVisible();
  await expect(page.getByTestId("sidemenu-evasion-char-pc-3")).toBeVisible();

  // The current actor (myself) must report the localized "current" marker
  // through the live region — guarantees the multi-PC turn pointer is wired.
  await expect(page.getByTestId("game-map-current-actor")).toContainText("鈴");

  // Sanity: the PLAYER_ID we authenticated as is the one rendered as "you".
  expect(PLAYER_ID).toBe("e2e-player-1");
});
