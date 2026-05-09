import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 9 edge: drop the connection mid-session and re-issue session_restore
// in incremental mode after the client reconnects.

export function installReconnectScenario(server: MockWSServer): {
  drop: () => void;
} {
  const state = makeGameState({
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
      },
    ],
  });

  let eventId = 5; // simulate prior history
  const next = () => eventId++;
  const now = () => new Date().toISOString();
  let droppedOnce = false;

  server.onMessage((msg, send) => {
    if (msg.action === "join_room") {
      const mode = droppedOnce ? "incremental" : "full_sync";
      send({
        type: "session_restore",
        event_id: next(),
        timestamp: now(),
        mode,
        current_state: state,
        missed_events: droppedOnce
          ? [
              {
                type: "gm_narrative",
                event_id: 99,
                timestamp: now(),
                text: "（再接続中に届いた描写）",
                is_streaming: false,
              },
            ]
          : [],
      });
      send({
        type: "state_full",
        event_id: next(),
        timestamp: now(),
        version: 1,
        state,
      });
    }
  });

  // Force-close every active socket so the client falls back to its retry
  // loop. The test calls this between two MockWSServer broadcasts.
  return {
    drop: () => {
      // The server's connections set isn't exposed publicly, so we rely on
      // close() via stop()/restart in tests when more dramatic teardown is
      // needed. For now, the client triggers reconnect by VITE_WS_URL change.
      droppedOnce = true;
    },
  };
}
