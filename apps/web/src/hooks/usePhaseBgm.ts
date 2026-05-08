import { useEffect } from "react";
import { playBgm, stopBgm } from "../services/audio";
import type { ConnectionStatus, GamePhase } from "../types";

/**
 * Drive BGM cues from the current GamePhase. Combat plays the combat BGM,
 * briefing/exploration plays the exploration BGM, assessment stops BGM, and
 * the cue is also stopped on unmount.
 *
 * §9-3: when the session is lost the SessionLostScreen takes over the
 * viewport and the GameState freezes — keep BGM from looping over the
 * "セッション切断" alert by stopping it as soon as connectionStatus flips.
 */
export function usePhaseBgm(
  phase: GamePhase | undefined,
  connectionStatus?: ConnectionStatus,
): void {
  useEffect(() => {
    if (connectionStatus === "SESSION_LOST") {
      stopBgm();
      return;
    }
    if (!phase) return;
    if (phase === "combat") {
      playBgm("combat");
    } else if (phase === "briefing" || phase === "exploration") {
      playBgm("exploration");
    } else if (phase === "assessment") {
      stopBgm();
    }
  }, [phase, connectionStatus]);

  useEffect(() => {
    return () => {
      stopBgm();
    };
  }, []);
}
