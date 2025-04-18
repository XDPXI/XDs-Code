import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

const host = null;

export default defineConfig(async () => ({
    plugins: [react()],

    clearScreen: false,
    server: {
        port: 1420,
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
