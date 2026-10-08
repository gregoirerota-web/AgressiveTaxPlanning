import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: { rollupOptions: { input: { classic: resolve(import.meta.dirname,"index.html"), online: resolve(import.meta.dirname,"multiplayer.html") } } },
  server: { proxy: { "/socket.io": { target: "http://127.0.0.1:3001", ws: true }, "/api": { target: "http://127.0.0.1:3001" } } }
});