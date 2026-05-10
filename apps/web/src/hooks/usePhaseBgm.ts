import { useEffect, useRef } from "react";
import { playBgm, playSe, stopBgm } from "../services/audio";
import type { ConnectionStatus, GamePhase, SessionOutcome } from "../types";

/**
 * Drive BGM cues from the current GamePhase. Combat plays the combat BGM,
 * briefing/exploration plays the exploration BGM, assessment stops BGM, and
 * the cue is also stopped on unmount.
 *
 * §9-3: when the session is lost the SessionLostScreen takes over the
 * viewport and the GameState freezes — keep BGM from looping over the
 * "セッション切断" alert by stopping it as soon as connectionStatus flips.
 *
 * §11 Phase 9 jingles: when phase transitions exploration→combat the
 * `battle_start` SE plays once, and when combat→assessment with a victory
 * outcome the `victory_jingle` SE plays once. Tracked via a ref so phase
 * re-renders without an actual change don't re-fire the cue.
 */
export function usePhaseBgm(
  phase: GamePhase | undefined,
  connectionStatus?: ConnectionStatus,
  outcome?: SessionOutcome | null,
): void {
  const prevPhaseRef = useRef<GamePhase | undefined>(undefined);

  useEffect(() => {
    if (connectionStatus === "SESSION_LOST") {
      stopBgm();
      prevPhaseRef.current = phase;
      return;
    }
    const prev = prevPhaseRef.current;
    if (!phase) {
      prevPhaseRef.current = phase;
      return;
    }
    if (phase === "combat") {
      if (prev === "exploration" || prev === "briefing") {
        playSe("battle_start");
      }
      playBgm("combat");
    } else if (phase === "briefing" || phase === "exploration") {
      playBgm("exploration");
    } else if (phase === "assessment") {
      if (prev === "combat" && outcome === "victory") {
        playSe("victory_jingle");
      }
      stopBgm();
    }
    prevPhaseRef.current = phase;
  }, [phase, connectionStatus, outcome]);

  useEffect(() => {
    return () => {
      stopBgm();
    };
  }, []);
}
