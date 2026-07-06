import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

interface TerminalProps {
  currentDir: string;
  onCtrlC?: () => void;
  theme?: string;
}

const MAX_TERMINAL_LINES = 1000;

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

const Terminal: React.FC<TerminalProps> = ({ currentDir, onCtrlC, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const busyRef = useRef(false);
  const commandBufferRef = useRef("");
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const unlistenersRef = useRef<Array<() => void>>([]);
  const lineCountRef = useRef(0);
  const localDirRef = useRef<string>(currentDir || "~");
  const ctrlCPendingRef = useRef(false);

  const getFontSize = (): number => {
    const size = getComputedStyle(document.documentElement).getPropertyValue(
      "--terminal-font-size",
    );
    if (size) {
      return parseInt(size);
    }
    return 13;
  };

  useEffect(() => {
    if (!xtermRef.current) return;
    const themeMap: Record<string, typeof defaultTerminalTheme> = {
      "windows-xp": xpTerminalTheme,
      legacy: legacyTerminalTheme,
      "one-dark": defaultTerminalTheme,
      "one-light": oneLightTerminalTheme,
    };
    xtermRef.current.options.theme = themeMap[theme || "one-dark"] || defaultTerminalTheme;
  }, [theme]);

  useEffect(() => {
    const themeMap: Record<string, typeof defaultTerminalTheme> = {
      "windows-xp": xpTerminalTheme,
      legacy: legacyTerminalTheme,
      "one-dark": defaultTerminalTheme,
      "one-light": oneLightTerminalTheme,
    };
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: getFontSize(),
      theme: themeMap[theme || "one-dark"] || defaultTerminalTheme,
      allowProposedApi: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current!);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let mounted = true;

    const setupListeners = async () => {
      // Initialize persistent shell session
      try {
        await invoke("init_terminal_shell", {
          cwd: localDirRef.current || undefined,
        });
      } catch (err) {
        xterm.writeln(`\x1b[31mFailed to start shell: ${err}\x1b[0m`);
      }

      displayPrompt();

      const unlisteners = await Promise.all([
        listen<string>("terminal-output", handleOutputEvent),
        listen<string>("terminal-error", handleErrorEvent),
        listen<string>("command-finished", handleFinishEvent),
      ]);

      if (mounted) {
        unlistenersRef.current = unlisteners;
      } else {
        unlisteners.forEach((u) => u());
      }
    };

    setupListeners();

    xterm.onData((data) => {
      handleTerminalInput(data, xterm);
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    });
    resizeObserver.observe(terminalRef.current!);

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      xterm.dispose();
      unlistenersRef.current.forEach((unlisten) => unlisten());
      // Kill the shell on unmount
      invoke("stop_terminal_command").catch(() => {});
    };
  }, []);

  const displayPrompt = () => {
    const cwdLabel = localDirRef.current || "~";
    xtermRef.current?.write(`\x1b[32m${cwdLabel}\x1b[0m \x1b[36m$\x1b[0m `);
  };

  const handleOutputEvent = (event: any) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    xterm.writeln(event.payload);
    lineCountRef.current++;

    if (lineCountRef.current > MAX_TERMINAL_LINES) {
      xterm.clear();
      lineCountRef.current = 0;
      xterm.writeln("\x1b[90m[Terminal history cleared]\x1b[0m");
    }
  };

  const handleErrorEvent = (event: any) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    xterm.writeln(`\x1b[31m${event.payload}\x1b[0m`);
    lineCountRef.current++;

    if (lineCountRef.current > MAX_TERMINAL_LINES) {
      xterm.clear();
      lineCountRef.current = 0;
      xterm.writeln("\x1b[90m[Terminal history cleared]\x1b[0m");
    }
  };

  const handleFinishEvent = (event: any) => {
    // Ignore stale finish events after Ctrl+C (shell was restarted)
    if (ctrlCPendingRef.current) {
      ctrlCPendingRef.current = false;
      return;
    }

    // Parse "exitcode___/path/to/cwd" from payload
    const payload = (event.payload as string) || "";
    if (payload) {
      const sepIdx = payload.indexOf("___");
      if (sepIdx !== -1) {
        const newPwd = payload.substring(sepIdx + 3).trim();
        if (newPwd) {
          localDirRef.current = newPwd;
        }
      }
    }

    busyRef.current = false;
    commandBufferRef.current = "";
    historyIndexRef.current = -1;
    displayPrompt();
  };

  const handleTerminalInput = (data: string, xterm: XTerm) => {
    const code = data.charCodeAt(0);

    // Ctrl+C
    if (code === 3) {
      if (busyRef.current) {
        xterm.write("^C\r\n");
        busyRef.current = false;
        commandBufferRef.current = "";
        historyIndexRef.current = -1;
        ctrlCPendingRef.current = true;

        // Kill shell and restart in current directory so the interrupted command dies
        invoke("stop_terminal_command")
          .catch(() => {})
          .finally(() => {
            invoke("init_terminal_shell", {
              cwd: localDirRef.current || undefined,
            }).catch((err) => {
              xterm.writeln(`\x1b[31mFailed to restart shell: ${err}\x1b[0m`);
            });
          });

        displayPrompt();

        if (onCtrlC) {
          onCtrlC();
        }
      } else {
        xterm.write("^C\r\n");
        displayPrompt();
      }
      return;
    }

    if (busyRef.current) return;

    // Arrow Up - History Previous
    if (data === "\x1b[A") {
      if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
        historyIndexRef.current++;
        const historicalCmd =
          commandHistoryRef.current[
            commandHistoryRef.current.length - 1 - historyIndexRef.current
          ];
        clearCurrentInput(xterm);
        commandBufferRef.current = historicalCmd;
        xterm.write(historicalCmd);
      }
      return;
    }

    // Arrow Down - History Next
    if (data === "\x1b[B") {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const historicalCmd =
          commandHistoryRef.current[
            commandHistoryRef.current.length - 1 - historyIndexRef.current
          ];
        clearCurrentInput(xterm);
        commandBufferRef.current = historicalCmd;
        xterm.write(historicalCmd);
      } else if (historyIndexRef.current === 0) {
        historyIndexRef.current = -1;
        clearCurrentInput(xterm);
        commandBufferRef.current = "";
      }
      return;
    }

    // Enter
    if (code === 13) {
      xterm.write("\r\n");

      const command = commandBufferRef.current.trim();
      if (command.length > 0) {
        // Handle built-in commands
        if (command === "clear" || command === "cls") {
          xterm.clear();
          lineCountRef.current = 0;
          displayPrompt();
          commandBufferRef.current = "";
          historyIndexRef.current = -1;
          return;
        }

        // Add to history
        commandHistoryRef.current.push(command);
        historyIndexRef.current = -1;

        busyRef.current = true;
        commandBufferRef.current = "";

        invoke("execute_terminal_command", {
          command,
          cwd: localDirRef.current || undefined,
        }).catch((err) => {
          xterm.write(`\x1b[31mError: ${err}\x1b[0m\r\n`);
          busyRef.current = false;
          displayPrompt();
          commandBufferRef.current = "";
          historyIndexRef.current = -1;
        });
      } else {
        displayPrompt();
      }

      return;
    }

    // Backspace
    if (code === 127) {
      if (commandBufferRef.current.length > 0) {
        commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        xterm.write("\b \b");
      }
      return;
    }

    // Printable characters
    commandBufferRef.current += data;
    xterm.write(data);
  };

  const clearCurrentInput = (xterm: XTerm) => {
    for (let i = 0; i < commandBufferRef.current.length; i++) {
      xterm.write("\b \b");
    }
  };

  return (
    <div
      ref={terminalRef}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: theme === "windows-xp" ? "#000000" : (theme === "legacy" ? "#1e1e1e" : (theme === "one-light" ? "#f5f5f5" : "#282c33")),
      }}
    />
  );
};

export default Terminal;
