import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { playSe } from "../../services/audio";

// §11 Phase 5 cutin: enter (200ms) → hold (1400ms) → exit (200ms).
// reduced-motion collapses to hold-only, preserving total duration.
const CUTSCENE_PHASES = {
  enter: 200,
  hold: 1400,
  exit: 200,
} as const;
const CUTSCENE_TOTAL_MS =
  CUTSCENE_PHASES.enter + CUTSCENE_PHASES.hold + CUTSCENE_PHASES.exit;

type CutscenePhase = "enter" | "hold" | "exit";

export default function CastArtCutscene() {
  const { t } = useTranslation();
  const cutscene = useUIStore((s) => s.castArtCutscene);
  const clear = useUIStore((s) => s.clearCastArtCutscene);
  // §17 a11y: motion-reduce suppresses the pulse / glow animation.
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<CutscenePhase>("enter");

  useEffect(() => {
    if (!cutscene) return;
    // Fire the cutin SE once on mount per cutscene; the existing cast_art SE
    // is fired by the action submitter (Room.tsx). cutin overlays atmosphere.
    playSe("cutin");

    if (reducedMotion) {
      setPhase("hold");
      const id = setTimeout(clear, CUTSCENE_TOTAL_MS);
      return () => clearTimeout(id);
    }
    setPhase("enter");
    const enterId = setTimeout(() => setPhase("hold"), CUTSCENE_PHASES.enter);
    const exitId = setTimeout(
      () => setPhase("exit"),
      CUTSCENE_PHASES.enter + CUTSCENE_PHASES.hold,
    );
    const clearId = setTimeout(clear, CUTSCENE_TOTAL_MS);
    return () => {
      clearTimeout(enterId);
      clearTimeout(exitId);
      clearTimeout(clearId);
    };
  }, [cutscene, clear, reducedMotion]);

  if (!cutscene) return null;

  const phaseClass = reducedMotion
    ? ""
    : phase === "enter"
      ? "opacity-0 scale-90"
      : phase === "exit"
        ? "opacity-0 scale-105"
        : "opacity-100 scale-100";

  return (
    <div
      key={cutscene.id}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none cast-art-cutscene"
      data-testid="cast-art-cutscene"
      data-phase={phase}
    >
      <span className="sr-only" data-testid="cast-art-cutscene-announce">
        {t("room.castArt.cutsceneAnnounce", {
          caster: cutscene.casterName,
          art: cutscene.artName,
        })}
      </span>
      <div
        aria-hidden="true"
        data-reduced-motion={reducedMotion || undefined}
        className="contents"
      >
        <div
          className={`absolute inset-0 bg-purple-900/30 ${
            reducedMotion ? "" : "animate-pulse"
          }`}
        />
        <div
          className={`relative transition-all duration-200 ease-out ${phaseClass}`}
        >
          <div className="absolute inset-0 -inset-x-32 bg-purple-500/20 blur-3xl rounded-full" />
          <div className="relative px-12 py-6 bg-gradient-to-r from-purple-900/90 via-fuchsia-900/90 to-purple-900/90 border-2 border-purple-300 rounded-lg shadow-[0_0_60px_rgba(168,85,247,0.6)]">
            <div className="text-xs text-purple-200 tracking-[0.3em] uppercase text-center">
              {cutscene.casterName}
            </div>
            <div
              className="text-4xl font-bold text-white text-center mt-1 tracking-widest"
              style={{ textShadow: "0 0 24px rgba(216, 180, 254, 0.9)" }}
            >
              {cutscene.artName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
