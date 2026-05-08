import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../stores";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { Grade, GrowthProposal, SessionScore } from "../../types";

interface Props {
  onBackToLobby: () => void;
}

const GRADE_COLOR: Record<Grade, string> = {
  S: "text-yellow-300 border-yellow-400",
  A: "text-amber-300 border-amber-400",
  B: "text-emerald-300 border-emerald-400",
  C: "text-sky-300 border-sky-400",
  D: "text-gray-300 border-gray-500",
};

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-700 last:border-b-0 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}

export default function AssessmentScreen({ onBackToLobby }: Props) {
  const { t } = useTranslation();
  const { gameState, myPlayerId } = useGameStore();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusedOnceRef = useRef(false);

  const isOpen =
    gameState?.phase === "assessment" && !!gameState.assessment_result;

  const buttonRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      node.focus();
    }
  }, []);

  useFocusTrap(overlayRef, isOpen);

  if (!gameState || gameState.phase !== "assessment") {
    focusedOnceRef.current = false;
    return null;
  }
  const score: SessionScore | null | undefined = gameState.assessment_result;
  if (!score) {
    focusedOnceRef.current = false;
    return null;
  }

  const isVictory = score.outcome === "victory";
  const gradeColor = GRADE_COLOR[score.grade];

  const myCharIds = new Set(
    gameState.characters
      .filter((c) => c.player_id === myPlayerId)
      .map((c) => c.id),
  );
  const myProposals: GrowthProposal[] = (gameState.growth_proposals ?? []).filter(
    (p) => myCharIds.has(p.character_id),
  );
  const charNameById = new Map(
    gameState.characters.map((c) => [c.id, c.name] as const),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return;
    e.preventDefault();
    onBackToLobby();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="assessment-screen-title"
      aria-describedby="assessment-screen-stats"
      data-testid="assessment-screen"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-900 rounded-xl p-8 w-[28rem] shadow-2xl border-2 border-gray-700">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            {t("room.assessment.title")}
          </p>
          <h2
            id="assessment-screen-title"
            className={`text-2xl font-bold mt-1 ${
              isVictory ? "text-yellow-300" : "text-red-400"
            }`}
          >
            {isVictory
              ? t("room.assessment.outcomeVictory")
              : t("room.assessment.outcomeDefeat")}
          </h2>
        </div>

        <div className="flex justify-center mb-6">
          <div
            className={`w-28 h-28 rounded-full border-4 flex items-center justify-center text-6xl font-black bg-gray-950 ${gradeColor}`}
            data-testid="assessment-grade"
            role="img"
            aria-label={t(`room.assessment.gradeLabel.${score.grade}`)}
          >
            {score.grade}
          </div>
        </div>

        <div
          id="assessment-screen-stats"
          className="bg-gray-950/60 rounded p-3 mb-6"
        >
          <StatRow
            label={t("room.assessment.rounds")}
            value={score.rounds_taken}
          />
          <StatRow
            label={t("room.assessment.pcsAlive")}
            value={`${score.pcs_alive} / ${score.pcs_total}`}
          />
          <StatRow
            label={t("room.assessment.enemiesDefeated")}
            value={`${score.enemies_defeated} / ${score.enemies_total}`}
          />
          <StatRow
            label={t("room.assessment.grade")}
            value={t(`room.assessment.gradeLabel.${score.grade}`)}
          />
        </div>

        {myProposals.length > 0 && (
          <section
            className="bg-gray-950/60 rounded p-3 mb-6"
            data-testid="growth-proposals"
            aria-labelledby="assessment-growth-title"
          >
            <p
              id="assessment-growth-title"
              className="text-xs text-gray-400 uppercase tracking-wider mb-2"
            >
              {t("room.assessment.growthTitle")}
            </p>
            <ul className="space-y-1">
              {myProposals.map((p, i) => (
                <li
                  key={`${p.character_id}-${p.grow_type}-${p.name}-${i}`}
                  className="flex items-center justify-between text-sm border-b border-gray-800 last:border-b-0 py-1"
                  data-testid="growth-proposal-item"
                >
                  <span className="text-gray-300">
                    {charNameById.get(p.character_id) ?? p.character_id}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                        p.grow_type === "art"
                          ? "bg-purple-900/60 text-purple-200"
                          : "bg-emerald-900/60 text-emerald-200"
                      }`}
                    >
                      {t(`room.assessment.growthType.${p.grow_type}`)}
                    </span>
                    <span className="font-mono text-white">{p.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          ref={buttonRef}
          onClick={onBackToLobby}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded py-2 font-semibold"
          data-testid="assessment-back"
        >
          {t("room.assessment.backToLobby")}
        </button>
      </div>
    </div>
  );
}
