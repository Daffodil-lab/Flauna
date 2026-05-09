# TacEx-Web

タクティカル祓魔師TRPG フロントエンド

## 起動

```bash
pnpm install
pnpm -F web dev
# http://localhost:5173
```

## テスト

```bash
pnpm -F web test          # vitest (unit + integration)
pnpm -F web typecheck
pnpm -F web build
pnpm -F web e2e           # Playwright (§12-4)
pnpm -F web lhci          # Lighthouse CI (§18)
pnpm -F web bundle-budget # gzip ≤ 800 KB (§18)
pnpm -F web analyze       # bundle stats.html
```

## E2E (§12-3 / §12-4)

E2E は `tests/e2e/` 配下、`tests/fixtures/mock_ws_server.ts` の `MockWSServer`
を使った WebSocket 往復テスト。シナリオは `tests/fixtures/scenarios/` 配下:

- `smoke_one_turn` — Phase 3 スモーク
- `cast_art_flow` / `barrier_flow` / `multi_player` — Phase 5 主要機能
- `long_session` / `edge_reconnect` / `edge_version_mismatch` — Phase 9 長時間 / エッジ

ローカル初回のみ Playwright のブラウザ取得が必要:

```bash
pnpm exec playwright install --with-deps chromium
```

## パフォーマンス目標 (§18)

| 項目 | 目標 | 計測 |
|---|---|---|
| 初回ロード (FCP / TTI) | ≤ 5 s | Lighthouse CI |
| バンドル (gzip) | ≤ 800 KB | `pnpm -F web bundle-budget` |
| サーバ→DOM 反映 | ≤ 200 ms | `tests/e2e/perf.spec.ts` |
| WS 接続 | ≤ 2 s | `tests/e2e/perf.spec.ts` |
| 60 秒メモリ増 | ≤ 80 MB | `tests/e2e/perf.spec.ts` (chromium) |
