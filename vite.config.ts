import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createServer } from "net";

const host = null;
const basePort = 6382;

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
};

const findAvailablePort = async (startPort: number): Promise<number> => {
  for (let port = startPort; port <= 99999; port++) {
    if (await isPortAvailable(port)) {
      if (port != basePort)
        console.log(`Using port ${port} (configured port ${basePort} was in use)`);
      return port;
    }
  }
  return startPort;
};

export default defineConfig(async () => {
  const availablePort = await findAvailablePort(basePort);
  const hmrPort = availablePort + 1;

  return {
    plugins: [react()],

    clearScreen: false,
    server: {
      port: availablePort,
      strictPort: false,
      host: false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: hmrPort,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
