/**
 * Phase 9 edge-case E2E (spec §12-4): long-session and adversarial paths
 * that the per-phase unit tests touch in isolation but never end-to-end:
 *
 *   1. VERSION_MISMATCH error → client auto-resubmits with the latest
 *      version and surfaces the retry toast (§9-3).
 *   2. evade_required → client mounts the dialog, submitting forwards a
 *      submit_evasion frame to the server.
 *   3. session_lost frame → SessionLostScreen takes over the room.
 */
import { test, expect, ROOM_ID } from "./_fixtures/mockBackend";
import { makeState, nextEventId } from "./_fixtures/state";

async function arriveInRoomWithState(
  page: import("@playwright/test").Page,
  mock: import("./_fixtures/mockBackend").MockBackend,
) {
  await page.goto("/");
  await page.getByTestId("lobby-player-name").fill("E2E太郎");
  await page.getByRole("button", { name: /ルームを作成|Create/ }).click();
  await page.waitForURL(`**/room/${ROOM_ID}`);
  await mock.ready();
  mock.send({
    type: "session_restore",
    event_id: nextEventId(),
    current_state: makeState(),
    pendings: [],
  });
  await expect(page.getByTestId("game-map")).toBeVisible();
}

test("VERSION_MISMATCH error triggers an automatic resubmit with the latest version", async ({
  page,
  mock,
}) => {
  await arriveInRoomWithState(page, mock);

  // Bump the room version on the client first — this is the new "latest"
  // the resubmit must use.
  mock.send({
    type: "state_full",
    event_id: nextEventId(),
    state: makeState({ version: 2 }),
  });

  // Fire an attack from the UI; capture the original submit.
  await page.getByTestId("game-map-actions-char-enemy").click();
  await page.getByRole("menuitem", { name: /攻撃する|Attack/ }).first().click();

  await expect
    .poll(() => mock.sentByAction("submit_turn_action").length, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);

  // Server rejects with VERSION_MISMATCH. The client should auto-resubmit.
  mock.send({
    type: "error",
    event_id: nextEventId(),
    code: "VERSION_MISMATCH",
    message: "expected_version is stale",
  });

  await expect
    .poll(() => mock.sentByAction("submit_turn_action").length, { timeout: 5_000 })
    .toBeGreaterThanOrEqual(2);

  const submits = mock.sentByAction("submit_turn_action") as Array<
    Record<string, unknown>
  >;
  // The latest submission must reflect the server's most recent version.
  expect(submits[submits.length - 1]?.expected_version).toBe(2);

  // Toast surfaces the retry notice (§9-3).
  await expect(page.getByTestId("toast-info")).toBeVisible();
});

test("evade_required mounts the dialog and submitting sends submit_evasion", async ({
  page,
  mock,
}) => {
  await arriveInRoomWithState(page, mock);

  mock.send({
    type: "evade_required",
    event_id: nextEventId(),
    pending_id: "pend-evade-1",
    attacker_id: "char-enemy",
    target_id: "char-pc",
    deadline_seconds: 60,
  });

  await expect(page.getByTestId("evasion-dialog")).toBeVisible();
  await page.getByTestId("evasion-submit").click();

  await expect
    .poll(() => mock.sentByAction("submit_evasion").length, { timeout: 5_000 })
    .toBeGreaterThan(0);

  const sent = mock.sentByAction("submit_evasion")[0] as Record<string, unknown>;
  expect(sent.pending_id).toBe("pend-evade-1");
});

test("session_lost frame routes the user to the dedicated lost-session screen", async ({
  page,
  mock,
}) => {
  await arriveInRoomWithState(page, mock);

  mock.send({
    type: "session_lost",
    event_id: nextEventId(),
    reason: "ttl_exceeded",
  });

  await expect(page.getByTestId("session-lost-screen")).toBeVisible();
  await expect(page.getByTestId("session-lost-back")).toBeFocused();
});
