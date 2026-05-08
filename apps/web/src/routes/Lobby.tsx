import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createRoom } from "../services/api";
import { loadPlayerName, savePlayerName } from "../services/sessionPersistence";
import { LanguageSwitcher } from "../components/common";

export default function Lobby() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] = useState("first_mission");
  const [playerName, setPlayerName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  useEffect(() => {
    const saved = loadPlayerName();
    if (saved) setPlayerName(saved);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    savePlayerName(playerName);
    const res = await createRoom({ scenario_id: scenarioId, player_name: playerName });
    navigate(`/room/${res.room_id}`);
  };

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = joinRoomId.trim();
    if (!trimmed) return;
    savePlayerName(playerName);
    navigate(`/room/${trimmed}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
      <div className="absolute top-3 right-3">
        <LanguageSwitcher className="flex items-center gap-1 text-xs text-gray-700" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-center">
        {t("app.name")}
      </h1>
      <h2 className="text-lg sm:text-xl">{t("lobby.title")}</h2>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 w-full max-w-sm"
        aria-label={t("lobby.createRoom")}
      >
        {/* §17 a11y: explicit htmlFor/id so SR users get a robust label-to-input
            association even when the wrapping <label> is bypassed. */}
        <label htmlFor="lobby-scenario-id" className="flex flex-col gap-1">
          <span>{t("lobby.scenarioId")}</span>
          <input
            id="lobby-scenario-id"
            className="border rounded px-2 py-1"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            required
          />
        </label>
        <label htmlFor="lobby-player-name" className="flex flex-col gap-1">
          <span>{t("lobby.playerName")}</span>
          <input
            id="lobby-player-name"
            data-testid="lobby-player-name"
            className="border rounded px-2 py-1"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          {t("lobby.createRoom")}
        </button>
      </form>

      <form
        onSubmit={handleJoin}
        className="flex flex-col gap-2 w-full max-w-sm"
        aria-label={t("lobby.joinRoom")}
      >
        <label htmlFor="lobby-room-id" className="flex flex-col gap-1">
          <span>{t("lobby.roomId")}</span>
          <input
            id="lobby-room-id"
            data-testid="lobby-room-id"
            className="border rounded px-2 py-1"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
          />
        </label>
        <button
          type="submit"
          data-testid="lobby-join-button"
          disabled={!joinRoomId.trim()}
          className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("lobby.joinRoom")}
        </button>
      </form>
    </main>
  );
}
