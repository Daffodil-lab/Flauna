import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, useUIStore } from "../../stores";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { ARTS, getArt } from "../../utils/arts";
import type { ArtName, CastArtPayload } from "../../types";

interface Props {
  onSubmit: (payload: CastArtPayload) => void;
}

export default function CastArtModal({ onSubmit }: Props) {
  const { t } = useTranslation();
  const { activeModal, castArtTargetId, closeModal } = useUIStore();
  const { gameState, myPlayerId } = useGameStore();

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusedOnceRef = useRef(false);
  const cancelRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      node.focus();
    }
  }, []);

  const myChar = gameState?.characters.find((c) => c.player_id === myPlayerId);
  const knownArtNames = useMemo(
    () => new Set((myChar?.arts ?? []) as string[]),
    [myChar?.arts],
  );
  const availableArts = useMemo(
    () => ARTS.filter((a) => knownArtNames.has(a.name)),
    [knownArtNames],
  );

  const [artName, setArtName] = useState<ArtName | null>(null);
  const [targetId, setTargetId] = useState<string | null>(castArtTargetId);

  const isOpen = activeModal === "cast_art";
  useFocusTrap(overlayRef, isOpen);

  const selectedArt = artName ? getArt(artName) : null;
  const needsTarget = selectedArt?.target_type === "single";
  const mp = myChar?.mp ?? 0;
  const canAfford = selectedArt ? mp >= selectedArt.mp_cost : false;
  const targetPickable = useMemo(
    () =>
      gameState?.characters.filter(
        (c) => c.id !== myChar?.id && c.faction !== "neutral",
      ) ?? [],
    [gameState?.characters, myChar?.id],
  );

  const canSubmit =
    !!selectedArt && canAfford && (!needsTarget || !!targetId);

  const handleSubmit = useCallback(() => {
    if (!selectedArt) return;
    const payload: CastArtPayload = { art_name: selectedArt.name };
    if (needsTarget && targetId) payload.target = targetId;
    if (selectedArt.target_type === "self" && myChar) {
      payload.target = myChar.id;
    }
    onSubmit(payload);
    closeModal();
  }, [selectedArt, needsTarget, targetId, myChar, onSubmit, closeModal]);

  if (!isOpen || !myChar) {
    focusedOnceRef.current = false;
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return;
    if (!canSubmit) return;
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-art-title"
      data-testid="cast-art-modal"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-900 border border-purple-500 rounded-lg p-6 w-[28rem] text-white">
        <h2
          id="cast-art-title"
          className="text-lg font-bold text-purple-300 mb-3"
        >
          {t("room.castArt.title")}
        </h2>

        <div className="text-xs text-gray-400 mb-3">
          {t("room.castArt.mp", { current: mp, max: myChar.max_mp })}
        </div>

        {availableArts.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            {t("room.castArt.noneLearned")}
          </div>
        ) : (
          <div
            className="space-y-1 mb-3 max-h-56 overflow-y-auto"
            role="radiogroup"
            aria-labelledby="cast-art-title"
            data-testid="cast-art-pick-group"
          >
            {availableArts.map((a) => {
              const affordable = mp >= a.mp_cost;
              const isSelected = artName === a.name;
              return (
                <label
                  key={a.name}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                    isSelected
                      ? "bg-purple-900/60 border border-purple-400"
                      : "hover:bg-gray-800 border border-transparent"
                  } ${!affordable ? "opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="art"
                    value={a.name}
                    checked={isSelected}
                    disabled={!affordable}
                    onChange={() => setArtName(a.name)}
                    className="mt-1 accent-purple-400"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-purple-300">MP {a.mp_cost}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 leading-snug">
                      {a.description}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {t(`room.castArt.targetType.${a.target_type}`)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {needsTarget && (
          <div className="mb-3">
            <label
              htmlFor="cast-art-target"
              className="text-xs text-gray-400 block mb-1"
            >
              {t("room.castArt.pickTarget")}
            </label>
            <select
              id="cast-art-target"
              value={targetId ?? ""}
              onChange={(e) => setTargetId(e.target.value || null)}
              className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-gray-600"
            >
              <option value="">—</option>
              {targetPickable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (HP {c.hp}/{c.max_hp})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            ref={cancelRef}
            onClick={closeModal}
            data-testid="cast-art-cancel"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded py-2 text-sm"
          >
            {t("room.action.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded py-2 text-sm font-semibold"
            data-testid="cast-art-submit"
          >
            {t("room.castArt.cast")}
          </button>
        </div>
      </div>
    </div>
  );
}
