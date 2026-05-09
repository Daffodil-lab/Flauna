import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../src/i18n/index";
import CastArtCutscene from "../../src/components/dialogs/CastArtCutscene";
import { useUIStore } from "../../src/stores";
import { setAudioBackend } from "../../src/services/audio";

const matchMediaMock = vi.fn();

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage("ja");
  useUIStore.setState({ castArtCutscene: null } as never);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: matchMediaMock,
  });
  matchMediaMock.mockImplementation((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useUIStore.setState({ castArtCutscene: null } as never);
});

function renderCutscene() {
  return render(
    React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(CastArtCutscene),
    ),
  );
}

describe("Phase 9 cutscene: enter/hold/exit phase progression", () => {
  it("walks enter → hold → exit and clears after total duration", () => {
    const playSeSpy = vi.fn();
    setAudioBackend({
      playSe: playSeSpy,
      playBgm: vi.fn(),
      stopBgm: vi.fn(),
    });

    renderCutscene();
    act(() => {
      useUIStore.getState().triggerCastArtCutscene({
        id: "c1",
        artName: "霊弾発射",
        casterName: "茜",
      });
    });

    expect(playSeSpy).toHaveBeenCalledWith("cutin", expect.any(Number));

    expect(screen.getByTestId("cast-art-cutscene").dataset.phase).toBe("enter");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("cast-art-cutscene").dataset.phase).toBe("hold");

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getByTestId("cast-art-cutscene").dataset.phase).toBe("exit");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("cast-art-cutscene")).toBeNull();
  });

  it("collapses to hold-only when prefers-reduced-motion is set", () => {
    matchMediaMock.mockImplementation((q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    setAudioBackend({
      playSe: vi.fn(),
      playBgm: vi.fn(),
      stopBgm: vi.fn(),
    });

    renderCutscene();
    act(() => {
      useUIStore.getState().triggerCastArtCutscene({
        id: "c2",
        artName: "霊弾発射",
        casterName: "茜",
      });
    });

    expect(screen.getByTestId("cast-art-cutscene").dataset.phase).toBe("hold");

    act(() => {
      vi.advanceTimersByTime(1799);
    });
    expect(screen.getByTestId("cast-art-cutscene")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByTestId("cast-art-cutscene")).toBeNull();
  });
});
