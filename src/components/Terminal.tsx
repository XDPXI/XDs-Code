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

const Terminal: React.FC<TerminalProps> = ({ currentDir, onCtrlC }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [busy, setBusy] = useState(false);
  const commandBufferRef = useRef(""); // keep buffer across renders

  useEffect(() => {
    // Initialize terminal only once
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
      theme: {
        background: "#282c33",
        foreground: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current!);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // initial prompt
    xterm.write("$ ");

    let unlistenOut: () => void;
    let unlistenErr: () => void;
    let unlistenFinished: () => void;

    // listen to stdout
    listen<string>("terminal-output", (event) => {
      xterm.writeln(event.payload);
    }).then((f) => (unlistenOut = f));

    // listen to stderr
    listen<string>("terminal-error", (event) => {
      xterm.writeln(`\x1b[31m${event.payload}\x1b[0m`);
    }).then((f) => (unlistenErr = f));

    // listen to command finished
    listen("command-finished", () => {
      setBusy(false);
      xterm.write("$ ");
      commandBufferRef.current = "";
    }).then((f) => (unlistenFinished = f));

    // handle input
    xterm.onData((data) => {
      const code = data.charCodeAt(0);

      // Ctrl+C
      if (code === 3) {
        if (busy) {
          xterm.write("^C\r\n");
          setBusy(false);
          xterm.write("$ ");
          commandBufferRef.current = "";

          if (onCtrlC) {
            onCtrlC();
          }
        } else {
          xterm.write("^C\r\n$ ");
        }
        return;
      }

      if (busy) return;

      // Enter
      if (code === 13) {
        xterm.write("\r\n");

        const command = commandBufferRef.current.trim();
        if (command.length > 0) {
          setBusy(true);
          invoke("execute_terminal_command", {
            command,
            cwd: currentDir || undefined,
          }).catch((err) => {
            console.error("Execute command error:", err);
            xterm.write(`\x1b[31mError: ${err}\x1b[0m\r\n`);
            setBusy(false);
            xterm.write("$ ");
            commandBufferRef.current = "";
          });
        } else {
          xterm.write("$ ");
          commandBufferRef.current = "";
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
    });

    // handle terminal resize
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalRef.current!);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      unlistenOut?.();
      unlistenErr?.();
      unlistenFinished?.();
    };
  }, []);

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
