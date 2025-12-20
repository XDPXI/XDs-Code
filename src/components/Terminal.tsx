import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";

import "xterm/css/xterm.css";

interface TerminalProps {
  currentDir: string;
}

const Terminal: React.FC<TerminalProps> = ({ currentDir }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
      theme: {
        background: "#282c33",
      },
    });

    const fitAddon = new FitAddon();

    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current!);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.write("$ ");

    let commandBuffer = "";

    xterm.onData(async (data) => {
      const code = data.charCodeAt(0);

      // Enter
      if (code === 13) {
        xterm.write("\r\n");

        if (commandBuffer.trim().length > 0) {
          try {
            const result = await invoke<string>("execute_terminal_command", {
              command: commandBuffer,
              cwd: currentDir || undefined,
            });

            if (result) {
              xterm.write(result.replace(/\n/g, "\r\n"));
            }
          } catch (err) {
            xterm.writeln(`Error: ${err}`);
          }
        }

        commandBuffer = "";
        xterm.write("\r\n$ ");
        return;
      }

      // Backspace
      if (code === 127) {
        if (commandBuffer.length > 0) {
          commandBuffer = commandBuffer.slice(0, -1);
          xterm.write("\b \b");
        }
        return;
      }

      // Printable characters
      commandBuffer += data;
      xterm.write(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });

    resizeObserver.observe(terminalRef.current!);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
    };
  }, [currentDir]);

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
