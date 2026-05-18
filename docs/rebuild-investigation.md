# VTT フレームワーク化リビルド調査

## Context

Flauna は現在、(1) Python/FastAPI の AI-GM バックエンド `apps/gm` (~6.7K LOC)、(2) React/Vite/Konva のフロントエンド `apps/web` (~6.5K LOC)、(3) 両者の WebSocket 通信契約を担う `packages/ws-schema` (Pydantic → JSON Schema → Zod/TS 自動生成パイプライン) の 3 層構成のモノレポ。

本ドキュメントは「単一アプリケーションとして作り直す」検討を契機に開始した技術調査だが、製品ビジョンの確定とともに「**Foundry Virtual Tabletop に AI 機能を拡張した汎用 VTT フレームワーク**」を目標とする戦略リビルドの意思決定ドキュメントへと発展した。

実装には踏み込まず、技術選定・配信モデル・運用コスト・OSS 戦略のトレードオフを言語化することを目的とする。本ドキュメントを元にマイルストーンごとに別ブランチで実装する。

---

## 確定方針

| 項目 | 確定内容 |
|---|---|
| プロダクト形態 | **Foundry VTT に AI 拡張を載せた汎用 VTT フレームワーク** |
| ターゲット | GM/PL 双方が抵抗なく使える。広い普及を狙う |
| 料金 | **完全無料**。AI はユーザーが自分で用意 (**BYOK**) |
| ルールシステム対応 | **汎用 VTT + システム抽象化** (D&D / CoC / タクティカル祓魔師 等を pack で対応) |
| 運用モデル | **OSS セルフホスト推奨** (Docker 一発配備) |
| AI 利用形態 | **両モード提供**: 「AI が GM 代行」 + 「人間 GM の補助」 切替可 |

推奨実装スタック: **TypeScript 単一 + Fastify + Colyseus + React + PixiJS + Vercel AI SDK (BYOK) + SQLite/libSQL + Docker Compose**。

既存タクティカル祓魔師 TRPG 資産は捨てない: `systems/tacex/` パックとして再構築し、フレームワークの第一ファーストパーティ実装と位置付ける。

---

## 現状アーキテクチャ

| レイヤ | 主要ファイル | 特徴 |
|---|---|---|
| GM 中核ロジック | `apps/gm/src/tacex_gm/engine/` (1,767 LOC), `engine/combat.py`, `engine/dice.py` | ダイス・命中・回避・ダメージ計算。純粋関数中心 |
| WS ハンドラ | `apps/gm/src/tacex_gm/ws/handler.py` (1,326 LOC) | 多人数同期、ターンループ、AI 思考段階、死亡回避分岐 |
| 状態管理 | `apps/gm/src/tacex_gm/room/session.py` | `asyncio.Lock` / `asyncio.Event` / `asyncio.Queue` を活用したルーム単位の同期 |
| 永続化 | `apps/gm/src/tacex_gm/persistence/` (aiosqlite) | SQLite。ルーム/プレイヤー shell のみ保存、GameState は scenario から再構築 |
| AI 統合 | `apps/gm/src/tacex_gm/ai/` | Anthropic / OpenAI / mock の抽象化 + Jinja2 ナレーション |
| 通信契約 | `apps/gm/src/tacex_gm/ws/messages.py` → `packages/ws-schema/` | Pydantic を SSoT として JSON Schema → TS 型を自動導出 |
| フロント | `apps/web/src/` | React 18 + Zustand 6 ストア + Konva マップ + i18n + WS 自動再接続 |

通信は **REST (`/api/v1/rooms`) + WebSocket (`/room/{room_id}`)** の 2 系統。フロントは型のみを `@flauna/ws-schema` から取り込み、Vite dev proxy で `/api` を Python へ転送。

---

## 検討した選択肢の俯瞰

「単一アプリ化」「リビルド」が何を意味するかで論点が大きく変わる。検討した全選択肢:

| 案 | 言語 | 既存資産再利用 | 工数 | 設計刷新度 | OSS 依存 | 推奨ケース |
|---|---|---|---|---|---|---|
| A. TS 統一 (Next.js) | TS | フロント 70%, バック 0% (移植) | 高 | 低 | 標準的 | 言語統一最優先 |
| B. FastAPI 静的配信 | 両言語 | 100% | 低 | なし | なし | デプロイ簡素化のみ |
| C. HTMX SSR | Py | バック 80%, フロント 0% | 中 | 中 | HTMX | Konva 不要なら |
| D. ラップ配布 | 両言語 | 100% | 最低 | なし | Docker/Tauri | 何も変えず配布のみ |
| E. ゼロベース | 任意 | 0% (仕様参照) | 中〜高 | 最大 | 任意 | 設計刷新が真の目的 |
| F. Colyseus | TS | engine 移植 | 中 | 大 | Colyseus | 多人数同期を任せたい |
| G. boardgame.io | TS | engine 移植 | 中 | 大 | boardgame.io | ターン制が綺麗に嵌るなら |
| H. PartyKit/Durable Objects | TS | engine 移植 | 中 | 大 | Cloudflare | エッジ・サーバレス志向 |
| I. Convex / Liveblocks / Yjs | TS | バック大幅捨て | 高 | 大 | Convex 等 | 不適合の可能性大 |
| J. Vercel AI SDK | 任意 | ai/ のみ置換 | 低 | 局所 | Vercel AI SDK | A/E/F/H と併用 |
| K. Foundry VTT モジュール化 | JS | フロント 0%, バック移植 | 中 | 大 | Foundry | プロダクト方針転換可なら |
| L. シングルプレイヤー化 | 任意 | 大半再利用 | 低 | 小 | なし | 仕様縮退OK なら |
| M. リアルタイム放棄 | 任意 | 中 | 中 | 中 | なし | WS の苦痛が利益を上回るなら |
| N. デスクトップ化 (Tauri) | 任意 | フロント維持 | 中 | 中 | Tauri | 個人ツール化OK なら |
| O. ブラウザ LLM | TS | バック消失 | 中 | 大 | Web LLM | 品質要件次第 (現状非現実的) |
| P. 人間 GM 補助モード | 任意 | engine 維持, AI 簡素化 | 中 | 大 | なし | プロダクト方針転換可なら |

---

## ビジョン適合度ランキング

「Foundry+AI で簡単・完全無料な汎用 VTT」を軸に再評価:

| 案 | 適合 | コメント |
|---|---|---|
| **E. ゼロベース** | ◎ | VTT 化は機能追加が膨大。既存コードに引きずられるより新規が速い |
| **F. Colyseus** | ◎ | 多人数同期は VTT の本質。トークン移動の broadcast に最適。OSS セルフホスト容易 |
| **P. 人間 GM 補助** | ◎ | 「AI 拡張版 VTT」ビジョンに合致。両モード提供で AI 代行 (現状路線) も維持 |
| **H. PartyKit / Durable Objects** | ○ | 無料運用に強いが Cloudflare ロックインがセルフホスト原則と矛盾 |
| **I. Yjs (部分)** | ○ | トークン位置の協調編集に CRDT が向く |
| **A. TS 統一 (Next.js)** | ○ | 標準的・無難 |
| **J. Vercel AI SDK** | ○ | 採用案問わず併用推奨 |
| **K. Foundry モジュール化** | ❌ | Foundry の難しさを継承。ビジョンと矛盾 |
| **B / C / D** | ❌ | 現状コードを温存しても VTT 機能追加コストは同じ |
| **L. シングル化** | ❌ | VTT はマルチプレイヤーが本質 |
| **M. リアルタイム放棄** | ❌ | トークン移動・FoW にリアルタイムは必須 |
| **N. デスクトップ化** | △ | Foundry と同じ難しさを引き継ぐ |

---

## 競合 VTT との位置取り

| プロダクト | 配信形態 | 料金 | 強み | 弱み (Flauna が狙う隙間) |
|---|---|---|---|---|
| **Foundry VTT** | セルフホスト (Node) | $50 買切 | 拡張性・モジュール豊富 | セットアップ難・自前サーバ要・PL もインストール考慮要 |
| **Roll20** | SaaS | 無料+課金 | URL 一発参加・実績 | UI 古い・拡張性低・有料機能多い |
| **Owlbear Rodeo** | SaaS (Cloudflare) | 無料+課金 | ミニマル・即起動 | 機能少・カスタム不可 |
| **Mythic Table** | OSS+SaaS | 無料 | OSS で透明・自由 | 開発停滞気味・機能未成熟 |
| **MapTool** | デスクトップ Java | 無料 | フル機能 | UI 古い・初心者向けでない |
| **Above VTT** | ブラウザ拡張 | 無料 | D&D Beyond 連携 | D&D 専用 |

Flauna の差別化軸:
- **AI-native** (シナリオ提案, NPC 即興応答, ルール質問対応, シーン描写) — 現状 VTT に存在しない領域
- **URL 一発参加** (Owlbear/Roll20 と同等の即時性)
- **OSS + 完全無料** (Mythic Table 同等だが開発活発)
- **GM 補助 + GM 代行両モード** (Foundry より高い自動化度)

---

## 採用アーキテクチャ詳細 (E + F + J + P/A)

### 採用要素と理由

| 要素 | 採用案 | 理由 |
|---|---|---|
| 言語 | TypeScript 統一 | E (ゼロベース)・OSS コミュニティ最大・コントリビュータ確保 |
| バック | Node.js (Fastify) + Colyseus | F: 多人数同期 OSS 老舗・セルフホスト容易・Docker 1 発配備可 |
| フロント | React 18 + PixiJS v8 | Konva 卒業・Foundry も PixiJS・VTT 標準・タッチ最適化済 |
| 状態同期 | Colyseus Schema + Yjs (部分) | トークンドラッグなど高頻度 op に CRDT 併用 |
| AI | Vercel AI SDK (BYOK) | J: provider 中立 (Anthropic/OpenAI/Ollama/Together) ・streaming |
| AI モード | 両モード切替 | P + 現状路線。"GM 代行" は handler.py の概念を縮小移植、"GM 補助" は新規 |
| 永続化 | SQLite (better-sqlite3) / libSQL | セルフホスト最小依存・Postgres 切替可 |
| デプロイ | Docker Compose 一発 / Fly.io | OSS セルフホスト推奨ライン |
| 認証 | Optional (匿名 URL 共有 + magic link 任意) | PL の参入障壁ゼロ |
| ライセンス | **AGPL-3.0 推奨** (SaaS 模倣抑制) or MIT (普及優先) | 別途決定要 |

### ディレクトリ構造案

```
flauna-vtt/
├── apps/
│   └── flauna/                  # 唯一の deploy 単位
│       ├── src/
│       │   ├── server/          # Fastify + Colyseus rooms
│       │   ├── client/          # React + PixiJS SPA
│       │   ├── shared/          # 型・スキーマ (ws-schema 廃止しここに統合)
│       │   ├── engine/          # ルール抽象基盤
│       │   ├── ai/              # Vercel AI SDK ラッパ・BYOK 管理
│       │   └── systems/         # TRPG system packs (built-in)
│       └── docker-compose.yml
└── systems/                     # 外部 system pack のサンプル/コミュニティ
    ├── tacex/                    # 既存タクティカル祓魔師 (移植)
    ├── dnd5e-lite/
    └── coc7th-lite/
```

ws-schema の Pydantic↔Zod 二重契約は消滅。`src/shared/` 内の Zod スキーマが SSoT。

### システム抽象化アーキテクチャ (最重要設計)

TRPG system pack の interface 例:

```typescript
export interface TRPGSystem {
  id: string;                              // "tacex", "dnd5e", "coc7"
  metadata: { name, version, locale[] };
  characterSheet: ZodSchema;               // バリデーション
  characterSheetComponent: ReactComponent; // 動的ロード
  diceMechanics: DiceEngine;               // ロール解決
  combatRules?: CombatRulesEngine;         // 戦闘有のシステム用
  rulesIndex?: RAGCorpus;                  // AI ルール質問用ベクトル
  aiPersona?: AIPersonaTemplate;           // システム別 GM persona
}
```

- 既存タクティカル祓魔師は `systems/tacex/` 配下の 1 pack として再構築
- `engine/combat.py` (1,167 LOC) → `systems/tacex/src/combat.ts` に移植 (engine のフレームワーク部分は core に上がる)
- 他システムは段階的に追加
- AI persona / システム別ルール RAG を pack に同梱

### AI 両モード切替

**モード A: GM 代行 (現状の TacEx-GM 路線継承)**
- AI が turn loop を主導、NPC アクション・ナレーション・回避要求を発行
- 既存 `apps/gm/src/tacex_gm/ws/handler.py` のロジックを大幅縮小して移植
  - `RoomLockRegistry` は Colyseus が単一スレッドのため不要 (削減)
  - idempotency cache は Colyseus の message ordering で代替 (削減)
- BYOK で Anthropic/OpenAI を呼ぶ

**モード B: GM 補助**
- 人間 GM が席に着く。AI は依頼ベースで応答
- `/ai npc <name> reaction:angry` のようなコマンド
- ルール質問: `/ai rules どれだけ離れていれば射撃ペナルティなしか?` → RAG (system pack 同梱コーパス)
- シーン描写ジェネレータ: `/ai describe forest_night`
- マップ生成補助: PNG をアップロード → AI でグリッドサイズ検出 / トークン候補抽出
- サーバはほぼステートレス。各リクエスト = LLM 呼び出し

**両モード共有基盤**
- BYOK 管理: ブラウザ IndexedDB 保存 + 接続時のみ送信 (サーバ永続化しない)
- LLM 呼び出し経路: クライアント→サーバ proxy (CORS/key 隠蔽用)。セルフホスト前提なら proxy が安全
- AI 応答ストリーミング: SSE or WS 経由

### 既存 Flauna 資産の再利用マッピング

| 既存ファイル | 再利用度 | 行先 |
|---|---|---|
| `apps/gm/src/tacex_gm/engine/` (1,767 LOC) | ◎ 概念ほぼ | `systems/tacex/src/` に TS 移植 |
| `apps/gm/src/tacex_gm/models/` (1,097 LOC) | ◎ | 同上 (Zod schema 化) |
| `apps/gm/src/tacex_gm/ws/handler.py` (1,326 LOC) | △ 半分以下 | core の room state machine + system pack hook に分解 |
| `apps/gm/src/tacex_gm/room/session.py` | × | Colyseus Room に置換 |
| `apps/gm/src/tacex_gm/persistence/` | × | better-sqlite3 で書き直し (より単純化可) |
| `apps/gm/src/tacex_gm/ai/` (665 LOC) | △ 設計のみ | Vercel AI SDK で再実装 |
| `apps/gm/src/tacex_gm/scenario/` | ◎ 概念 | system pack 同梱 YAML 形式へ |
| `apps/web/src/` (6,509 LOC) | △ コンポーネント設計とフロー | PixiJS 化に伴う再設計あり。Zustand stores / WS client / i18n / audio store は活用 |
| `apps/web/src/services/websocket.ts` | ◎ | Colyseus client に置換 |
| `packages/ws-schema/` | × | 廃止 (TS 単一スタックで不要) |
| `docs/tacex_*_spec_*.md` | ◎ 仕様参照 | `systems/tacex` pack の SSoT |

コード再利用率は概念レベルで ~50%、実コードレベルで ~20%。事実上のゼロベース再構築。

---

## マイルストーン (PoC → 製品化)

別ブランチで段階的に実装する想定:

1. **M0: Skeleton (1-2 週)** — Fastify + Colyseus + React + PixiJS の最小ループ。1 ルームで複数クライアントがトークンを動かせる
   - 想定ブランチ: `claude/flauna-vtt-m0-skeleton`
2. **M1: System Pack API (2 週)** — TRPGSystem interface 確定。tacex pack の characterSheet + dice のみ実装
   - 想定ブランチ: `claude/flauna-vtt-m1-system-pack-api`
3. **M2: AI 補助モード (2 週)** — BYOK 設定 UI、NPC reply / rules RAG / scene describe
   - 想定ブランチ: `claude/flauna-vtt-m2-ai-assist`
4. **M3: tacex pack の GM 代行モード移植 (3-4 週)** — handler.py の縮小移植
   - 想定ブランチ: `claude/flauna-vtt-m3-tacex-gm-port`
5. **M4: 基本 VTT 機能 (3 週)** — FoW、グリッド、計測、ハンドアウト、ダイスログ
6. **M5: OSS 公開 (継続)** — README、Docker Compose、`flauna init` CLI、ライセンス確定

---

## 主要リスクと緩和

| リスク | 緩和策 |
|---|---|
| スコープ膨張 (汎用 VTT は巨大) | tacex pack だけ動くマイルストーンを最優先。他システムはコミュニティに開放 |
| Konva→PixiJS の学習コスト | M0 で薄く検証。タッチ・パン・ズームの primitive は Foundry の OSS 部分を参考にできる |
| BYOK の UX 摩擦 (普及阻害) | デモルームは proxy 経由のサンプルキー (rate-limit 付) で「触ってみる」体験を確保 |
| AGPL vs MIT の宗教論 | 初期は AGPL で SaaS 模倣抑制 → community 育成後に再考 |
| 既存 tacex 資産の意義低下 | 既存 6.7K LOC のロジックは `systems/tacex/` pack として完全に活きる。捨てない |
| 同期負荷 (トークン高頻度移動) | Yjs CRDT 併用 + サーバ throttle |
| RAG コーパス維持コスト | system pack 開発者がコーパスを同梱する責任分散モデル |
| 製品スコープが現状の 5-10 倍に膨らむ | M0-M3 を tacex 専用と割り切り、汎用化は M4 以降 |
| 「無料」のサスティナビリティ | BYOK + セルフホスト推奨で AI コストはユーザー負担。CF/Vercel/Fly 無料枠でデモ運用 |
| AI 品質依存 | Vercel AI SDK の provider 中立性で乗り換え容易性を確保 |

---

## ビジョン由来の追加トレードオフ

### 「簡単に扱える」のための UX 摩擦削減
- アカウント登録: 完全匿名 (URL 共有のみ) が最大の参入障壁低減。永続化・スパム対策は magic link or OAuth 1-click を妥協点に
- シナリオ/キャラシ準備: Foundry の最大の参入障壁。AI でシナリオ・NPC 即生成できることが UX 差別化の核
- マップ準備: ブラウザでドラッグ&ドロップ画像 + AI でグリッド検出/トークン配置を提案
- ルール参照: AI への「○○の場合のルールは?」質問機能 (RAG ベース)
- ボイスチャット: 自前実装は重い → Discord 連携 or 無料 WebRTC SFU (LiveKit OSS) 検討

### 「完全無料」のための設計選択
- クライアント heavy アーキテクチャ (サーバ通信最小化) でホスティング費を圧縮
- AI 呼び出しはユーザーキーで (BYOK 必須)
- 画像・音声はユーザー側ストレージ参照 (R2/S3 直リン or IndexedDB) を選択肢に
- OSS ライセンス: AGPL/MIT どちらか。SaaS 模倣を許容するか

### 「より多くの人に使って欲しい」を満たすには
- OSS 化で開発者コミュニティを形成 → 機能追加が community driven に
- 多言語対応 (既存 i18n 基盤は活用可能)
- モバイル/タブレット対応 — PixiJS のタッチ最適化
- ドキュメント・チュートリアル整備
- デモルーム (登録不要で即体験) — 強力な promotion 手段

---

## 重要な参照ファイル (実装時に再読すべき)

- `apps/gm/src/tacex_gm/ws/handler.py` — 移植難度の本丸 (1,326 LOC)
- `apps/gm/src/tacex_gm/room/session.py` — async 同期プリミティブの設計
- `apps/gm/src/tacex_gm/ws/messages.py` — 通信契約 (Pydantic 14 + 5 メッセージ型)
- `apps/gm/src/tacex_gm/engine/combat.py` — tacex pack 移植の中核
- `apps/web/src/Room.tsx` — フロント中核 (~270+ 行 useEffect)
- `apps/web/src/services/websocket.ts` — WS クライアント (再接続/exp backoff)
- `docs/tacex_gm_spec_v2_5_FINAL.md` — tacex 仕様 SSoT
- `docs/tacex_web_spec_v1_1_FINAL.md` — Web 仕様 SSoT
- `docs/tacex_ws_schema_v1_0.md` — WS 通信契約仕様
