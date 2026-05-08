/**
 * Phase 3 smoke E2E (spec §12-4): the deferred Phase 3 smoke E2E that v1.1
 * promised — lobby → connect → 1-turn melee attack → narrative.
 *
 * The whole flight runs against a scripted WS mock; no GM uvicorn process is
 * required.
 */
import { test, expect, ROOM_ID } from "./_fixtures/mockBackend";
import { makeState, nextEventId } from "./_fixtures/state";

test("lobby → room → 1-turn attack → narrative is rendered", async ({ page, mock }) => {
  await page.goto("/");

  await page.getByTestId("lobby-player-name").fill("E2E太郎");
  await page.getByRole("button", { name: /ルームを作成|Create/ }).click();

  await page.waitForURL(`**/room/${ROOM_ID}`);

  // Client opened the WS and sent join_room — feed it a session_restore.
  await mock.ready();
  const initial = makeState();
  mock.send({
    type: "session_restore",
    event_id: nextEventId(),
    current_state: initial,
    pendings: [],
  });

  await expect(page.getByTestId("quickbar-end-turn")).toBeVisible();
  await expect(page.getByTestId("game-map-char-char-enemy")).toBeVisible();

  // Open context menu against the enemy via the keyboard-accessible
  // "open actions" button (mirror of the right-click flow). The button lives
  // in an sr-only list overlapped by the Konva canvas, so we bypass the
  // pointer-event interception check.
  await page.getByTestId("game-map-actions-char-enemy").click({ force: true });
  await expect(page.getByTestId("context-menu")).toBeVisible();

  await page.getByRole("menuitem", { name: /攻撃する|Attack/ }).first().click();

  // Wait until the mock backend has actually received the turn action frame
  // — confirms the WS round-trip is wired.
  await expect
    .poll(() => mock.sentByAction("submit_turn_action").length, {
      timeout: 5_000,
    })
    .toBeGreaterThan(0);

  // GM applies the action and streams a narrative.
  const after = makeState({
    version: 2,
    characters: [
      ...initial.characters.slice(0, 1),
      { ...initial.characters[1]!, hp: 0 },
    ],
  });
  mock.send({ type: "state_full", event_id: nextEventId(), state: after });
  mock.send({
    type: "gm_narrative",
    event_id: nextEventId(),
    text: "鈴の拳が怨霊を貫いた。",
    is_streaming: false,
  });

  await expect(page.getByText("鈴の拳が怨霊を貫いた。")).toBeVisible();
});
