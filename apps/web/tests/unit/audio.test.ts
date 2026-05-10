import { describe, it, expect, beforeEach, vi } from "vitest";
import { playSe, playBgm, stopBgm, setAudioBackend } from "../../src/services/audio";
import { useAudioStore } from "../../src/stores/audioStore";
import type { SeCue, BgmCue } from "../../src/services/audio";

const SE_CUES: SeCue[] = [
  "damage",
  "victory",
  "defeat",
  "cast_art",
  "escalation",
  "your_turn",
  "evade_alert",
  "death_avoidance_alert",
  "deadline_tick",
  "cutin",
  "battle_start",
  "victory_jingle",
];

const BGM_CUES: BgmCue[] = ["combat", "exploration"];

describe("Phase 9 audio: every cue resolves to a non-empty URL", () => {
  beforeEach(() => {
    useAudioStore.setState({ muted: false, volume: 0.6 });
  });

  it.each(SE_CUES)("playSe('%s') hands the backend a non-empty URL", (cue) => {
    const playSeSpy = vi.fn();
    setAudioBackend({
      playSe: playSeSpy,
      playBgm: vi.fn(),
      stopBgm: vi.fn(),
      setBgmVolume: vi.fn(),
    });
    playSe(cue);
    expect(playSeSpy).toHaveBeenCalledTimes(1);
    expect(playSeSpy).toHaveBeenCalledWith(cue, 0.6);
  });

  it.each(BGM_CUES)(
    "playBgm('%s') hands the backend a non-empty URL",
    (cue) => {
      const playBgmSpy = vi.fn();
      setAudioBackend({
        playSe: vi.fn(),
        playBgm: playBgmSpy,
        stopBgm: vi.fn(),
        setBgmVolume: vi.fn(),
      });
      playBgm(cue);
      expect(playBgmSpy).toHaveBeenCalledTimes(1);
      expect(playBgmSpy).toHaveBeenCalledWith(cue, 0.6);
    },
  );

  it("stopBgm is forwarded", () => {
    const stopBgmSpy = vi.fn();
    setAudioBackend({
      playSe: vi.fn(),
      playBgm: vi.fn(),
      stopBgm: stopBgmSpy,
    });
    stopBgm();
    expect(stopBgmSpy).toHaveBeenCalledTimes(1);
  });
});
