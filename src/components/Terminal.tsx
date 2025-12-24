import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

interface TerminalProps {
  currentDir: string;
  onCtrlC?: () => void;
}

const MAX_TERMINAL_LINES = 1000;

const Terminal: React.FC<TerminalProps> = ({ currentDir, onCtrlC }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [busy, setBusy] = useState(false);
  const commandBufferRef = useRef("");
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const unlistenersRef = useRef<Array<() => void>>([]);
  const lineCountRef = useRef(0);

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
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: getFontSize(),
      theme: {
        background: "#282c33",
        foreground: "#cbcfd4",
        cursor: "#74ade8",
        black: "#282c33",
        red: "#f48771",
        green: "#8ec07c",
        yellow: "#fabd2f",
        blue: "#74ade8",
        magenta: "#b16286",
        cyan: "#8ec07c",
        white: "#cbcfd4",
      },
      allowProposedApi: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current!);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    displayPrompt();

    let mounted = true;

    const setupListeners = async () => {
      const unlisteners = await Promise.all([
        listen<string>("terminal-output", handleOutputEvent),
        listen<string>("terminal-error", handleErrorEvent),
        listen("command-finished", handleFinishEvent),
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
    };
  }, []);

  const displayPrompt = () => {
    const cwdLabel = currentDir && currentDir !== "null" ? currentDir : "~";
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

  const handleFinishEvent = () => {
    setBusy(false);
    commandBufferRef.current = "";
    historyIndexRef.current = -1;
    displayPrompt();
  };

  const handleTerminalInput = (data: string, xterm: XTerm) => {
    const code = data.charCodeAt(0);

    // Ctrl+C
    if (code === 3) {
      if (busy) {
        xterm.write("^C\r\n");
        setBusy(false);
        displayPrompt();
        commandBufferRef.current = "";
        historyIndexRef.current = -1;

        if (onCtrlC) {
          onCtrlC();
        }
      } else {
        xterm.write("^C\r\n");
        displayPrompt();
      }
      return;
    }

    if (busy) return;

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

        setBusy(true);
        commandBufferRef.current = "";

        invoke("execute_terminal_command", {
          command,
          cwd: currentDir || undefined,
        }).catch((err) => {
          xterm.write(`\x1b[31mError: ${err}\x1b[0m\r\n`);
          setBusy(false);
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
        backgroundColor: "#282c33",
      }}
    />
  );
};

export default Terminal;
