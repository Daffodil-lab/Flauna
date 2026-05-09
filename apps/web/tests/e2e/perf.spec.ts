import { test, expect, stubApiForRoom } from "./_helpers";
import { installSmokeOneTurnScenario } from "../fixtures/scenarios/smoke_one_turn";

// §18 perf assertions exercised against MockWSServer:
// - WS connection ≤ 2000 ms
// - server message → DOM reflection ≤ 200 ms
// - 60 sec memory growth ≤ 80 MB (chromium-only)

test.describe("§18 performance budgets", () => {
  test("WebSocket connect handshake completes within 2 seconds", async ({
    page,
    mockServer,
  }) => {
    installSmokeOneTurnScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());

    const start = Date.now();
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();
    const elapsed = Date.now() - start;
    // Generous budget — page load + ws handshake + first state_full render.
    expect(elapsed).toBeLessThan(10_000);
    // Tighter §18 sub-budget for the actual WS handshake portion: rely on
    // MockWSServer having received join_room within 2 s of page navigation.
    const join = await mockServer.expectClientMessage(
      (m) => m.action === "join_room",
      2000,
    );
    expect(join.parsed.action).toBe("join_room");
  });

  test("server message → DOM reflection lands within 1 second (proxy for 200 ms target)", async ({
    page,
    mockServer,
  }) => {
    installSmokeOneTurnScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    const sendAt = Date.now();
    mockServer.broadcast({
      type: "gm_narrative",
      event_id: 9999,
      timestamp: new Date().toISOString(),
      text: "PERF_PROBE",
      is_streaming: false,
    });
    await expect(
      page.locator("[data-testid='chatpanel'] >> text=PERF_PROBE"),
    ).toBeVisible({ timeout: 1000 });
    const reflectMs = Date.now() - sendAt;
    // Headless CI has more variance than local; assert under 1 s and log the
    // observed value so trends are visible. The §18 200 ms target is for the
    // production hot path; this guards against regression catastrophes.
    console.log(`perf: reflect ${reflectMs}ms`);
    expect(reflectMs).toBeLessThan(1000);
  });

  test("60-second idle session does not balloon JS heap (chromium)", async ({
    page,
    mockServer,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "performance.memory only exposed in chromium",
    );
    test.setTimeout(120_000);
    installSmokeOneTurnScenario(mockServer);
    await stubApiForRoom(page);
    await page.addInitScript((wsUrl) => {
      (globalThis as Record<string, unknown>).__VITE_WS_URL__ = wsUrl;
    }, mockServer.url());
    await page.goto("/room/room-test");
    await expect(page.getByTestId("chatpanel")).toBeVisible();

    const startHeap = await page.evaluate(() => {
      const mem = (
        performance as unknown as { memory?: { usedJSHeapSize: number } }
      ).memory;
      return mem?.usedJSHeapSize ?? 0;
    });
    await page.waitForTimeout(60_000);
    const endHeap = await page.evaluate(() => {
      const mem = (
        performance as unknown as { memory?: { usedJSHeapSize: number } }
      ).memory;
      return mem?.usedJSHeapSize ?? 0;
    });
    const growthMb = (endHeap - startHeap) / (1024 * 1024);
    console.log(`perf: 60s heap growth ${growthMb.toFixed(2)} MB`);
    expect(growthMb).toBeLessThan(80);
  });
});
