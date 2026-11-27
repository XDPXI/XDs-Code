import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  currentDir: string;
  theme?: string;
}

const xpTerminalTheme = {
  background: "#000000",
  foreground: "#c0c0c0",
  cursor: "#c0c0c0",
  cursorAccent: "#000000",
  selectionBackground: "rgba(192, 192, 192, 0.3)",
  black: "#000000",
  red: "#800000",
  green: "#008000",
  yellow: "#808000",
  blue: "#000080",
  magenta: "#800080",
  cyan: "#008080",
  white: "#c0c0c0",
  brightBlack: "#808080",
  brightRed: "#ff0000",
  brightGreen: "#00ff00",
  brightYellow: "#ffff00",
  brightBlue: "#0000ff",
  brightMagenta: "#ff00ff",
  brightCyan: "#00ffff",
  brightWhite: "#ffffff",
};

const defaultTerminalTheme = {
  background: "#282c33",
  foreground: "#cbcfd4",
  cursor: "#74ade8",
  cursorAccent: "#282c33",
  selectionBackground: "rgba(116, 173, 232, 0.25)",
  black: "#282c33",
  red: "#e06c75",
  green: "#89c37b",
  yellow: "#d19a66",
  blue: "#74ade8",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#9ca2af",
  brightBlack: "#464b57",
  brightRed: "#f48771",
  brightGreen: "#a8d58d",
  brightYellow: "#fabd2f",
  brightBlue: "#8ec3f0",
  brightMagenta: "#d3869b",
  brightCyan: "#7ec8d3",
  brightWhite: "#cbcfd4",
};

const legacyTerminalTheme = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#ff6b6b",
  cursorAccent: "#1e1e1e",
  selectionBackground: "rgba(255, 107, 107, 0.25)",
  black: "#1e1e1e",
  red: "#ff6b6b",
  green: "#89c37b",
  yellow: "#d19a66",
  blue: "#74ade8",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#d4d4d4",
  brightBlack: "#3a3a3a",
  brightRed: "#ff8888",
  brightGreen: "#a8d58d",
  brightYellow: "#fabd2f",
  brightBlue: "#8ec3f0",
  brightMagenta: "#d3869b",
  brightCyan: "#7ec8d3",
  brightWhite: "#ffffff",
};

const oneLightTerminalTheme = {
  background: "#f5f5f5",
  foreground: "#383a42",
  cursor: "#0184bc",
  cursorAccent: "#f5f5f5",
  selectionBackground: "rgba(1, 132, 188, 0.25)",
  black: "#f5f5f5",
  red: "#e45649",
  green: "#4cb34a",
  yellow: "#c18401",
  blue: "#0184bc",
  magenta: "#7d5e7a",
  cyan: "#0997b3",
  white: "#383a42",
  brightBlack: "#a0a1a7",
  brightRed: "#e45649",
  brightGreen: "#50a14f",
  brightYellow: "#c18401",
  brightBlue: "#4078f2",
  brightMagenta: "#8b6b8f",
  brightCyan: "#0997b3",
  brightWhite: "#383a42",
};

const ESC = String.fromCharCode(27);
const CR = String.fromCharCode(13);
const RED = ESC + "[31m";
const GREY = ESC + "[90m";
const RESET = ESC + "[0m";

const themeMap: Record<string, typeof defaultTerminalTheme> = {
  "windows-xp": xpTerminalTheme,
  legacy: legacyTerminalTheme,
  "one-dark": defaultTerminalTheme,
  "one-light": oneLightTerminalTheme,
};

const getFontSize = (): number => {
  const size = getComputedStyle(document.documentElement).getPropertyValue(
    "--terminal-font-size",
  );
  const parsed = parseInt(size);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 13;
};

const Terminal: React.FC<TerminalProps> = ({ currentDir, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const cwdRef = useRef<string>(currentDir);

  useEffect(() => {
    cwdRef.current = currentDir;
  }, [currentDir]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = themeMap[theme || "one-dark"] || defaultTerminalTheme;
  }, [theme]);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: getFontSize(),
      theme: themeMap[theme || "one-dark"] || defaultTerminalTheme,
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(container);
    xtermRef.current = xterm;

    let disposed = false;
    let exited = false;
    let starting: Promise<void> | null = null;
    const unlisteners: Array<() => void> = [];

    const fit = () => {
      // Skip while hidden: a 0-size container would collapse the PTY to 2 cols.
      if (!container.clientWidth || !container.clientHeight) return;
      try {
        fitAddon.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    };

    // Start (or restart) the shell. Calls overlap-safe: one start at a time.
    const startShell = (): Promise<void> => {
      if (starting) return starting;
      starting = invoke("init_terminal_shell", {
        cwd: cwdRef.current || undefined,
        rows: xterm.rows,
        cols: xterm.cols,
      })
        .then(() => {
          exited = false;
        })
        .catch((err) => {
          xterm.writeln(RED + "Failed to start shell: " + String(err) + RESET);
          exited = true;
        })
        .finally(() => {
          starting = null;
        });
      return starting;
    };

    const send = async (data: string) => {
      if (exited) {
        xterm.write(ESC + "c");
        await startShell();
        if (exited) return;
        // The keypress that woke the shell is dropped, except Enter.
        if (data !== CR) return;
      }
      try {
        await invoke("write_terminal", { data });
      } catch {
        // Shell missing (killed/never started): restart once and retry.
        await startShell();
        if (!exited) {
          await invoke("write_terminal", { data }).catch(() => {});
        }
      }
    };

    xterm.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const mod = e.ctrlKey || e.metaKey;
      // Let app shortcuts reach the window handler.
      if (mod && !e.shiftKey && ["j", "w", "s"].includes(e.key.toLowerCase())) {
        return false;
      }
      // Copy: Ctrl+C with a selection (or Ctrl+Shift+C) copies; otherwise Ctrl+C is SIGINT.
      if (mod && e.key.toLowerCase() === "c" && (xterm.hasSelection() || e.shiftKey)) {
        const sel = xterm.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
        xterm.clearSelection();
        return false;
      }
      // Paste: Ctrl+Shift+V (plain Ctrl+V already pastes through the browser).
      if (mod && e.shiftKey && e.key.toLowerCase() === "v") {
        navigator.clipboard
          .readText()
          .then((t) => t && xterm.paste(t))
          .catch(() => {});
        return false;
      }
      return true;
    });

    const dataSub = xterm.onData((data) => {
      void send(data);
    });
    const resizeSub = xterm.onResize(({ rows, cols }) => {
      invoke("resize_terminal", { rows, cols }).catch(() => {});
    });

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);

    const setup = async () => {
      // Listeners first so no early shell output is lost.
      const [offData, offExit] = await Promise.all([
        listen<string>("terminal-data", (e) => xterm.write(e.payload)),
        listen("terminal-exit", () => {
          exited = true;
          xterm.writeln(CR + "\n" + GREY + "[Shell exited. Press Enter to restart]" + RESET);
        }),
      ]);
      unlisteners.push(offData, offExit);
      // Unmounted while awaiting (React StrictMode): do not spawn a shell nobody owns.
      if (disposed) return;
      fit();
      await startShell();
    };
    void setup();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataSub.dispose();
      resizeSub.dispose();
      unlisteners.forEach((u) => u());
      xterm.dispose();
      xtermRef.current = null;
      invoke("stop_terminal_command").catch(() => {});
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: (themeMap[theme || "one-dark"] || defaultTerminalTheme).background,
      }}
    />
  );
};

export default Terminal;
