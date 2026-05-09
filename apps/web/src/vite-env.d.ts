/// <reference types="vite/client" />

interface ImportMetaEnv {
  // §12-3 e2e: when set, ChatPanel/WebSocket use this base URL for the
  // real-time channel instead of `ws://${location.host}`. Tests boot a
  // MockWSServer and pass its port via this env var.
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
