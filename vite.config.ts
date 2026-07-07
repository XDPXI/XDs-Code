import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = null;

export default defineConfig(async () => ({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco-editor";
          if (id.includes("xterm")) return "xterm";
          if (id.includes("react-dom") || id.includes("react/")) return "react";
        },
      },
    },
  },

  clearScreen: false,
  server: {
    port: 6382,
    strictPort: true,
    host: false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
