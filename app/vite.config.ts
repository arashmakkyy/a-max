import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MV3 build:
 * - Relative base because the pages are opened from chrome-extension://<id>/dist/
 * - No inline scripts: the module preload polyfill is emitted inline, so it is off.
 * - Output goes to ../dist which the manifest points at.
 */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "chrome114",
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
  },
});
