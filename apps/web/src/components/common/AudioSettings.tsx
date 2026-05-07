import { useTranslation } from "react-i18next";
import { useAudioStore } from "../../stores";

type Props = {
  className?: string;
};

export default function AudioSettings({ className }: Props) {
  const { t } = useTranslation();
  const muted = useAudioStore((s) => s.muted);
  const volume = useAudioStore((s) => s.volume);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const setVolume = useAudioStore((s) => s.setVolume);

  const volumePct = Math.round(volume * 100);

  return (
    <div
      role="group"
      aria-label={t("settings.audio.groupLabel")}
      className={
        className ?? "flex items-center gap-1 text-xs text-gray-300"
      }
      data-testid="audio-settings"
    >
      <button
        type="button"
        aria-label={muted ? t("settings.audio.unmute") : t("settings.audio.mute")}
        aria-pressed={muted}
        onClick={toggleMuted}
        className="px-1 py-0.5 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700"
        data-testid="audio-mute-toggle"
      >
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volumePct}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label={t("settings.audio.volume")}
        aria-valuetext={t("settings.audio.volumeValue", { pct: volumePct })}
        className="w-16"
        data-testid="audio-volume-slider"
        disabled={muted}
      />
    </div>
  );
}
