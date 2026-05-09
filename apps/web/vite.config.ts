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
    },
  },
  build: {
    // §18 keeps total gzip bundle under 800 KB. Splitting Konva, framer-motion,
    // react, and zustand into vendor chunks brings the main chunk well below
    // Vite's 500 KB warning threshold and lets the browser parallelise loads.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          konva: ["konva", "react-konva"],
          motion: ["framer-motion"],
          state: ["zustand", "zod"],
          i18n: ["i18next", "react-i18next"],
        },
      },
    },
  },
});
