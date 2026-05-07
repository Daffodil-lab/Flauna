import { useTranslation } from "react-i18next";
import { useGameStore, useUIStore } from "../../stores";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { AudioSettings, LanguageSwitcher } from "../common";
import { CHAT_PANEL_ID } from "../chat";
import { SIDE_MENU_PANEL_ID } from "./SideMenu";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500",
  CONNECTING: "bg-yellow-400",
  AUTHENTICATING: "bg-yellow-400",
  DISCONNECTED: "bg-red-500",
  SESSION_LOST: "bg-red-700",
};

export default function Header() {
  const { t } = useTranslation();
  const { gameState, connectionStatus, myPlayerId } = useGameStore();
  const toggleSideMenu = useUIStore((s) => s.toggleSideMenu);
  const toggleChatPanel = useUIStore((s) => s.toggleChatPanel);
  const sideMenuOpen = useUIStore((s) => s.sideMenuOpen);
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const online = useOnlineStatus();

  const phaseKey = gameState
    ? (`room.phase.${gameState.phase}` as const)
    : null;

  const myPc = gameState?.characters.find(
    (c) => c.player_id === myPlayerId && c.faction === "pc",
  );
  const katashiro = myPc?.inventory["katashiro"] ?? null;
  const showMp = !!myPc && myPc.max_mp > 0;

  return (
    <header className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2 bg-gray-900 text-white text-sm flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        {gameState && (
          <button
            type="button"
            onClick={toggleSideMenu}
            aria-label={t("room.mobile.toggleSideMenu")}
            aria-expanded={sideMenuOpen}
            aria-controls={SIDE_MENU_PANEL_ID}
            data-testid="toggle-sidemenu"
            className="lg:hidden p-1 rounded hover:bg-gray-700"
          >
            <span aria-hidden="true">☰</span>
          </button>
        )}
        <span className="font-bold truncate">{t("app.name")}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        {gameState && (
          <>
            <span>{t("room.round", { n: gameState.round_number })}</span>
            <span className="text-gray-400">
              {phaseKey ? t(phaseKey) : ""}
            </span>
            {showMp && myPc && (
              <span
                className="text-purple-300"
                title={t("room.hud.mpLabel", {
                  current: myPc.mp,
                  max: myPc.max_mp,
                })}
                data-testid="hud-mp"
              >
                {t("room.hud.mpLabel", {
                  current: myPc.mp,
                  max: myPc.max_mp,
                })}
              </span>
            )}
            {katashiro !== null && (
              <span
                className="text-amber-300"
                title={t("room.hud.katashiro")}
                data-testid="hud-katashiro"
              >
                {t("room.hud.katashiroLabel", { n: katashiro })}
              </span>
            )}
            <span className="text-gray-500 font-mono text-xs">
              {gameState.room_id}
            </span>
          </>
        )}
        {/* Spec §17: connection state changes are surfaced to SR users as a
            named, polite live region so transitions like ACTIVE → DISCONNECTED
            are announced rather than silently flipping a colored dot. */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t("room.connection.label")}
          data-testid="connection-status"
          className="flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${
              online ? STATUS_COLORS[connectionStatus] ?? "bg-gray-500" : "bg-red-500"
            }`}
            title={online ? connectionStatus : "OFFLINE"}
            data-testid="connection-dot"
          />
          <span className="text-gray-400" data-testid="connection-label">
            {!online
              ? t("room.offline")
              : connectionStatus === "ACTIVE"
                ? t("room.connected")
                : t("room.connecting")}
          </span>
        </div>
        <AudioSettings />
        <LanguageSwitcher />
        {gameState && (
          <button
            type="button"
            onClick={toggleChatPanel}
            aria-label={t("room.mobile.toggleChatPanel")}
            aria-expanded={chatPanelOpen}
            aria-controls={CHAT_PANEL_ID}
            data-testid="toggle-chatpanel"
            className="lg:hidden p-1 rounded hover:bg-gray-700"
          >
            <span aria-hidden="true">💬</span>
          </button>
        )}
      </div>
    </header>
  );
}
