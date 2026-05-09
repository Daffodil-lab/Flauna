import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 9 edge: server replies with VERSION_MISMATCH on the first turn
// submission, then accepts the resubmit. Verifies the auto-resend path in
// services/turnActionResender.ts.

export function installVersionMismatchScenario(server: MockWSServer): void {
  const state = makeGameState({
    version: 1,
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
      },
      { id: "char-npc", name: "怨霊", faction: "npc" },
    ],
  });

  let eventId = 1;
  const next = () => eventId++;
  const now = () => new Date().toISOString();
  let attempts = 0;

  server.onMessage((msg, send) => {
    if (msg.action === "join_room") {
      send({
        type: "session_restore",
        event_id: next(),
        timestamp: now(),
        mode: "full_sync",
        current_state: state,
        missed_events: [],
      });
      send({
        type: "state_full",
        event_id: next(),
        timestamp: now(),
        version: 1,
        state,
      });
      send({
        type: "event",
        event_id: next(),
        timestamp: now(),
        event_name: "turn_start",
        payload: { actor_id: "char-pc" },
      });
      return;
    }
    if (msg.action === "submit_turn_action") {
      attempts += 1;
      if (attempts === 1) {
        send({
          type: "error",
          event_id: next(),
          timestamp: now(),
          code: "VERSION_MISMATCH",
          message: "Stale expected_version; please resubmit.",
          detail: { server_version: 2 },
          client_request_id: msg.client_request_id ?? null,
        });
        send({
          type: "state_full",
          event_id: next(),
          timestamp: now(),
          version: 2,
          state: { ...state, version: 2 },
        });
        return;
      }
      send({
        type: "gm_narrative",
        event_id: next(),
        timestamp: now(),
        text: "再送が受理され、攻撃が成立した。",
        is_streaming: false,
      });
    }
  });
}
