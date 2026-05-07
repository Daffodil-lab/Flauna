import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore, useGameStore } from "../../stores";

const AUTO_CLEAR_MS = 10_000;

const STAGE_LABEL_KEY: Record<string, string> = {
  deciding_action: "room.ai.stage.deciding_action",
  narrating: "room.ai.stage.narrating",
};

/**
 * Spec §9-2: while the server is in `ai_thinking`, surface a "GM考え中"
 * banner so the player knows the wait is intentional. The banner self-clears
 * after 10s as a safety net in case the server forgets to follow up.
 */
export default function AiThinkingIndicator() {
  const { t } = useTranslation();
  const aiThinking = useUIStore((s) => s.aiThinking);
  const clearAiThinking = useUIStore((s) => s.clearAiThinking);
  const characters = useGameStore((s) => s.gameState?.characters);

  useEffect(() => {
    if (!aiThinking) return;
    const timer = setTimeout(clearAiThinking, AUTO_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [aiThinking, clearAiThinking]);

  if (!aiThinking) return null;

  const actorName = aiThinking.actorId
    ? characters?.find((c) => c.id === aiThinking.actorId)?.name ?? null
    : null;
  const stageKey = STAGE_LABEL_KEY[aiThinking.stage];
  const stageLabel = stageKey ? t(stageKey) : aiThinking.stage;

  // Spec §17: announce as a polite live region so SR users hear the wait
  // intention without being yanked away from focus. aria-busy mirrors the
  // loading state; the visible glyph is decorative (aria-hidden).
  const srText = [t("room.ai.thinking"), stageLabel, actorName]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      aria-label={srText}
      data-testid="ai-thinking-indicator"
      className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20
        flex items-center gap-2 rounded-full border border-indigo-500/60
        bg-indigo-950/80 px-4 py-1.5 text-sm text-indigo-100 shadow-lg backdrop-blur"
    >
      <span
        className="inline-block h-2 w-2 rounded-full bg-indigo-300 animate-pulse"
        aria-hidden
      />
      <span className="font-medium" aria-hidden>
        {t("room.ai.thinking")}
      </span>
      <span className="text-indigo-300/80" aria-hidden>
        ·
      </span>
      <span className="text-indigo-200/90" aria-hidden>
        {stageLabel}
      </span>
      {actorName && (
        <>
          <span className="text-indigo-300/80" aria-hidden>
            ·
          </span>
          <span
            data-testid="ai-thinking-actor"
            className="text-indigo-200/90"
            aria-hidden
          >
            {actorName}
          </span>
        </>
      )}
    </div>
  );
}
