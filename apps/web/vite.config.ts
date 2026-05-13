import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import type { PluginOption } from "vite";

const ANALYZE = process.env.ANALYZE === "1";

export default defineConfig({
  plugins: [
    react(),
    ANALYZE &&
      (visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption),
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/room": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
  build: {
    // §18 keeps total gzip bundle under 800 KB. Konva is by far the heaviest
    // dependency (~290 KB raw / ~89 KB gzip) and is only loaded once a Room
    // is mounted, so split it out so the lobby paint isn't blocked on it.
    // Other React-flavoured deps (react/jsx-runtime, react-i18next, framer
    // -motion) are deliberately kept in the main chunk to avoid module-graph
    // ordering pitfalls that surfaced as a NO_FCP under Lighthouse CI.
    modulePreload: {
      // Vite preloads dynamic-chunk deps in the HTML by default so they can
      // race with the entry. For the lobby route that's a regression: the
      // konva chunk is unused on `/` and blocking it on the critical path is
      // what produces Lighthouse's NO_FCP. Filter konva out of the *HTML*
      // preload only — the runtime __vitePreload helper still fetches it
      // together with the lazy Room chunk when the user enters a room.
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType !== "html") return deps;
        return deps.filter((d) => !d.includes("konva"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/konva/") || id.includes("/react-konva/")) {
              return "konva";
            }
          }
          return undefined;
        },
      },
    },
  },
});
