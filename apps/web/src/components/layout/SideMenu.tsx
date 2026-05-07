import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, useUIStore } from "../../stores";
import type { Character, PressureLevel } from "../../types";

// Spec §17 keeps the side panel as a labelled complementary landmark, with the
// id/aria-controls handshake against the Header toggle so SR users learn the
// disclosure relationship and can close from the keyboard with Escape.
export const SIDE_MENU_PANEL_ID = "sidemenu-panel";

const PRESSURE_BG: Record<PressureLevel, string> = {
  normal: "bg-gray-800 border-gray-700",
  hard: "bg-orange-900/40 border-orange-500",
  ultra_hard: "bg-red-900/50 border-red-500",
};

const PRESSURE_TEXT: Record<PressureLevel, string> = {
  normal: "text-gray-300",
  hard: "text-orange-300",
  ultra_hard: "text-red-300",
};

const EVASION_DOT_LIMIT = 10;

function ResourceBar({
  current,
  max,
  color,
}: {
  current: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function EvasionDots({ current, max }: { current: number; max: number }) {
  if (max <= 0 || max > EVASION_DOT_LIMIT) return null;
  const filled = Math.max(0, Math.min(current, max));
  return (
    <span
      data-testid="evasion-dots"
      aria-hidden="true"
      className="text-[10px] tracking-tight text-gray-300"
    >
      {"●".repeat(filled)}
      <span className="text-gray-600">{"○".repeat(max - filled)}</span>
    </span>
  );
}

function CharCard({
  char,
  isCurrent,
  showPrivate,
}: {
  char: Character;
  isCurrent: boolean;
  showPrivate: boolean;
}) {
  const { t } = useTranslation();
  const katashiro = char.inventory?.["katashiro"];
  const statusEffects = char.status_effects ?? [];
  return (
    <div
      data-testid={`sidemenu-char-${char.id}`}
      {...(isCurrent ? { "aria-current": "true" } : {})}
      className={`p-2 rounded mb-2 text-sm ${
        isCurrent
          ? "border border-yellow-400 bg-gray-750"
          : "border border-gray-700 bg-gray-800"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold truncate">{char.name}</span>
        {isCurrent && (
          <span aria-hidden="true" className="text-xs text-yellow-400 ml-1">
            ▶
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t("room.hp")}</span>
          <span>
            {char.hp}/{char.max_hp}
          </span>
        </div>
        <ResourceBar current={char.hp} max={char.max_hp} color="bg-red-500" />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t("room.mp")}</span>
          <span>
            {char.mp}/{char.max_mp}
          </span>
        </div>
        <ResourceBar current={char.mp} max={char.max_mp} color="bg-blue-500" />
        <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span>{t("room.evasion")}</span>
          <span className="flex items-center gap-1">
            <EvasionDots
              current={char.evasion_dice}
              max={char.max_evasion_dice}
            />
            <span data-testid={`sidemenu-evasion-${char.id}`}>
              {char.evasion_dice}/{char.max_evasion_dice}
            </span>
          </span>
        </div>
        {showPrivate && typeof katashiro === "number" && (
          <div
            className="flex justify-between text-xs text-gray-400"
            data-testid={`sidemenu-katashiro-${char.id}`}
          >
            <span>{t("room.hud.katashiro")}</span>
            <span>{t("room.sideMenu.katashiroCount", { n: katashiro })}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2 text-xs text-gray-400">
          <span className="shrink-0">{t("room.sideMenu.status")}</span>
          {statusEffects.length === 0 ? (
            <span
              data-testid={`sidemenu-status-${char.id}`}
              className="text-gray-500"
            >
              {t("room.sideMenu.statusNone")}
            </span>
          ) : (
            <span
              data-testid={`sidemenu-status-${char.id}`}
              className="flex flex-wrap justify-end gap-1"
            >
              {statusEffects.map((effect, idx) => {
                const label =
                  effect.duration > 0
                    ? t("room.sideMenu.statusDuration", {
                        name: effect.name,
                        n: effect.duration,
                      })
                    : effect.name;
                return (
                  <span
                    key={`${effect.name}-${idx}`}
                    aria-label={label}
                    title={label}
                    className="px-1.5 py-0.5 rounded bg-purple-900/50 border border-purple-700 text-purple-200"
                  >
                    {effect.name}
                    {effect.duration > 0 && (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 text-purple-400"
                      >
                        ×{effect.duration}
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SideMenu() {
  const { t } = useTranslation();
  const { gameState, myPlayerId } = useGameStore();
  const sideMenuOpen = useUIStore((s) => s.sideMenuOpen);
  const closeMobilePanels = useUIStore((s) => s.closeMobilePanels);

  useEffect(() => {
    if (!sideMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMobilePanels();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sideMenuOpen, closeMobilePanels]);

  if (!gameState) return null;

  const { characters, turn_order, current_turn_index } = gameState;
  const currentActorId =
    turn_order.length > 0
      ? turn_order[current_turn_index % turn_order.length]
      : null;

  const myChars = characters.filter((c) => c.player_id === myPlayerId);
  const others = characters.filter((c) => c.player_id !== myPlayerId);

  return (
    <>
      {sideMenuOpen && (
        <button
          type="button"
          aria-label={t("room.mobile.closeSideMenu")}
          onClick={closeMobilePanels}
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          data-testid="sidemenu-backdrop"
        />
      )}
      <aside
        id={SIDE_MENU_PANEL_ID}
        aria-label={t("room.sideMenu.label")}
        data-testid="sidemenu"
        className={`w-52 bg-gray-900 text-white p-2 overflow-y-auto flex-shrink-0
          lg:relative lg:translate-x-0 lg:block
          fixed inset-y-0 left-0 z-40 transition-transform
          ${sideMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:transform-none`}
      >
      {myChars.map((c) => (
        <CharCard
          key={c.id}
          char={c}
          isCurrent={c.id === currentActorId}
          showPrivate={true}
        />
      ))}

      {others.length > 0 && (
        <>
          <div className="text-xs text-gray-500 uppercase tracking-wide my-2">
            {t("room.turnOrder")}
          </div>
          {others.map((c) => (
            <CharCard
              key={c.id}
              char={c}
              isCurrent={c.id === currentActorId}
              showPrivate={false}
            />
          ))}
        </>
      )}

      {turn_order.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {t("room.turnOrder")}
          </div>
          <ol className="space-y-0.5">
            {turn_order.map((id, i) => {
              const char = characters.find((c) => c.id === id);
              return (
                <li
                  key={id}
                  className={`text-xs px-1 rounded ${
                    i === current_turn_index % turn_order.length
                      ? "bg-yellow-700 text-white"
                      : "text-gray-400"
                  }`}
                >
                  {i + 1}. {char?.name ?? id}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {gameState.combat_pressure && (
        <div
          data-testid="hard-mode-panel"
          className={`mt-3 p-2 rounded border text-xs ${
            PRESSURE_BG[gameState.combat_pressure.level]
          }`}
        >
          <div className="text-gray-500 uppercase tracking-wide mb-1">
            {t("room.hardMode.title")}
          </div>
          <div
            data-testid="hard-mode-level"
            className={`font-semibold mb-1 ${
              PRESSURE_TEXT[gameState.combat_pressure.level]
            }`}
          >
            {t(`room.hardMode.level.${gameState.combat_pressure.level}`)}
          </div>
          <div
            data-testid="hard-mode-zero-rounds"
            className="text-gray-400"
          >
            {t("room.hardMode.zeroRounds", {
              n: gameState.combat_pressure.zero_damage_rounds,
            })}
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
