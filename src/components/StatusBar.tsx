import React from "react";

interface StatusBarProps {
  onTerminalToggle: () => void;
  onProjectStructureToggle: () => void;
  terminalOpen: boolean;
  projectStructureOpen: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onTerminalToggle,
  onProjectStructureToggle,
  terminalOpen,
  projectStructureOpen,
}) => {
  return (
    <div className="statusbar" data-tauri-drag-region>
      <div className="statusbar-left">
        <button
          className={`statusbar-button ${projectStructureOpen ? "active" : ""}`}
          onClick={onProjectStructureToggle}
          title="Toggle Project Structure (Ctrl+B)"
        >
          <i className="fa-solid fa-folder-tree" />
        </button>
      </div>
      <div className="statusbar-right">
        <button
          className={`statusbar-button ${terminalOpen ? "active" : ""}`}
          onClick={onTerminalToggle}
          title="Toggle Terminal (Ctrl+J)"
        >
          <i className="fa-solid fa-terminal" />
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
