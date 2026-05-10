# Audio assets

These are **placeholder silent WAV files** wired up so `services/audio.ts` can
resolve every `SeCue` / `BgmCue` to a non-empty URL. Each clip is 50–100 ms of
8 kHz/16-bit silence (~1 KB), so the bundle impact is negligible (~14 KB total).

## Replacing with real audio

Drop a real WAV/OGG/MP3 with the same filename:

```
apps/web/public/assets/audio/
├── se/
│   ├── damage.wav
│   ├── victory.wav
│   ├── defeat.wav
│   ├── cast_art.wav
│   ├── escalation.wav
│   ├── your_turn.wav
│   ├── evade_alert.wav
│   ├── death_avoidance_alert.wav
│   ├── deadline_tick.wav
│   ├── cutin.wav             # §11 cutin (Phase 5 演出)
│   ├── battle_start.wav      # §11 戦闘突入
│   └── victory_jingle.wav    # §11 セッション勝利
└── bgm/
    ├── combat.wav
    └── exploration.wav
```

If the extension changes, also update `SE_URLS` / `BGM_URLS` in
`apps/web/src/services/audio.ts`. Sourcing/licensing is tracked in a separate
ticket — these placeholders only guarantee the playback pipeline works.
