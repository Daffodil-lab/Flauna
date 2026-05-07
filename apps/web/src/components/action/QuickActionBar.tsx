import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, usePendingStore, useUIStore } from "../../stores";

interface Props {
  onEndTurn: () => void;
}

export default function QuickActionBar({ onEndTurn }: Props) {
  const { t } = useTranslation();
  const { gameState, myPlayerId } = useGameStore();
  const openCastArt = useUIStore((s) => s.openCastArt);
  const submitting = usePendingStore((s) => s.submittingTurnAction);
  const ref = useRef<HTMLDivElement>(null);
  // §17 a11y: roving tabindex — only one toolbar item is tabbable at a time.
  const [activeIndex, setActiveIndex] = useState(0);

  if (!gameState) return null;

  const { turn_order, current_turn_index, characters, machine_state } =
    gameState;
  const currentActorId =
    turn_order.length > 0
      ? turn_order[current_turn_index % turn_order.length]
      : null;
  const currentActor = characters.find((c) => c.id === currentActorId);
  const isMyTurn =
    currentActor?.player_id === myPlayerId &&
    machine_state === "IDLE";

  if (!isMyTurn) return null;

  const myChar = characters.find((c) => c.player_id === myPlayerId);
  const hasArts = (myChar?.arts ?? []).length > 0;

  const castArtIndex = hasArts ? 0 : -1;
  const endTurnIndex = hasArts ? 1 : 0;
  const itemCount = endTurnIndex + 1;

  const focusItemAt = (index: number) => {
    const wrapped = ((index % itemCount) + itemCount) % itemCount;
    setActiveIndex(wrapped);
    const items = ref.current?.querySelectorAll<HTMLButtonElement>(
      "[data-toolbar-item]",
    );
    items?.[wrapped]?.focus();
  };

  // §17 a11y: WAI-ARIA toolbar pattern — Left/Right roving + Home/End jump.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusItemAt(activeIndex + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusItemAt(activeIndex - 1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusItemAt(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusItemAt(itemCount - 1);
    }
  };

  // Clamp active index in case the item set shrank (e.g. arts were lost).
  const safeActive = Math.min(activeIndex, itemCount - 1);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t("room.quickAction.toolbar")}
      aria-busy={submitting}
      onKeyDown={handleKeyDown}
      className="border-t border-gray-700 bg-gray-900 px-4 py-2 flex items-center gap-3"
      data-testid="quickaction-bar"
    >
      <span className="text-yellow-400 text-sm font-semibold">
        {t("room.yourTurn")}
      </span>
      {hasArts && (
        <button
          type="button"
          data-toolbar-item=""
          tabIndex={safeActive === castArtIndex ? 0 : -1}
          onClick={() => openCastArt(null)}
          disabled={submitting}
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="quickbar-cast-art"
        >
          {t("room.castArt.button")}{" "}
          <span aria-hidden="true">✦</span>
        </button>
      )}
      <button
        type="button"
        data-toolbar-item=""
        tabIndex={safeActive === endTurnIndex ? 0 : -1}
        onClick={onEndTurn}
        disabled={submitting}
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="quickbar-end-turn"
      >
        {t("room.endTurn")}
      </button>
      {submitting && (
        <span
          className="text-gray-400 text-xs italic"
          data-testid="quickbar-submitting"
          role="status"
        >
          {t("room.submitting")}
        </span>
      )}
    </div>
  );
}
