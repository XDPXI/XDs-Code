import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

interface TerminalProps {
  currentDir: string;
  onCtrlC?: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ currentDir, onCtrlC }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [busy, setBusy] = useState(false);
  const commandBufferRef = useRef(""); // keep buffer across renders
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const unlistenersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    // Initialize terminal only once
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: 13,
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

    // initial prompt
    displayPrompt();

    const handleOutputEvent = async (event: any) => {
      xterm.writeln(event.payload);
    };

    const handleErrorEvent = async (event: any) => {
      xterm.writeln(`\x1b[31m${event.payload}\x1b[0m`);
    };

    const handleFinishEvent = async () => {
      setBusy(false);
      commandBufferRef.current = "";
      historyIndexRef.current = -1;
      displayPrompt();
    };

    // Listen to events
    Promise.all([
      listen<string>("terminal-output", handleOutputEvent),
      listen<string>("terminal-error", handleErrorEvent),
      listen("command-finished", handleFinishEvent),
    ]).then((unlisteners) => {
      unlistenersRef.current = unlisteners;
    });

    // Handle input
    xterm.onData((data) => {
      handleTerminalInput(data, xterm);
    });

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    });
    resizeObserver.observe(terminalRef.current!);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      unlistenersRef.current.forEach((unlisten) => unlisten());
    };
  }, []);

  const displayPrompt = () => {
    const cwdLabel =
      currentDir && currentDir !== "null" ? currentDir : "~";
    xtermRef.current?.write(`\x1b[32m${cwdLabel}\x1b[0m \x1b[36m$\x1b[0m `);
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
        historyIndexRef.current = -1;
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
