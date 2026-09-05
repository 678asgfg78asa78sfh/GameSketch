import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

function localCanvasFonts() {
  return {
    name: "local-canvas-fonts",
    buildStart() {
      cpSync(
        fileURLToPath(new URL("./node_modules/@excalidraw/excalidraw/dist/prod/fonts", import.meta.url)),
        fileURLToPath(new URL("./web/public/excalidraw/fonts", import.meta.url)),
        { recursive: true },
      );
    },
  };
}

export default defineConfig({
  root: "web",
  plugins: [localCanvasFonts(), react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:4321" }, // dev: UI -> server
  },
});
