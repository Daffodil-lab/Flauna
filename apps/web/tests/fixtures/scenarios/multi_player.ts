import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 5 multi-player: two PCs share the same room. The MockWSServer routes
// player_statement messages between connections so each client sees the
// other's chatter.

export function installMultiPlayerScenario(server: MockWSServer): void {
  const state = makeGameState({
    characters: [
      {
        id: "char-pc1",
        name: "アリス",
        player_id: "player-1",
        faction: "pc",
        position: [3, 3],
      },
      {
        id: "char-pc2",
        name: "茜",
        player_id: "player-2",
        faction: "pc",
        position: [4, 3],
      },
    ],
  });

  let eventId = 1;
  const next = () => eventId++;
  const now = () => new Date().toISOString();

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
      return;
    }
    if (msg.action === "player_statement") {
      // Broadcast back to both connections so both pages see the message.
      server.broadcast({
        type: "gm_narrative",
        event_id: next(),
        timestamp: now(),
        text: `${msg.player_id as string}: ${msg.text as string}`,
        is_streaming: false,
        scope: msg.scope ?? "all",
        to_player_id: msg.to_player_id ?? null,
      });
    }
  });
}
