import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

import { existsSync } from "node:fs";

const isDocker = existsSync("/.dockerenv");
const backendTarget = process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || (isDocker ? "http://server:5001" : "http://localhost:5001");

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        editor: resolve(projectRoot, "index.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/**/__fixtures__/**"],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  worker: {
    format: "es",
  },
  server: {
    headers: isolationHeaders,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  preview: {
    headers: isolationHeaders,
  },
  plugins: [react()],
});
