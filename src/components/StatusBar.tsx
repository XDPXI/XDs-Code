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
    <div className="statusbar">
      <div className="statusbar-left">
        <button
          className={`statusbar-button ${projectStructureOpen ? "active" : ""}`}
          onClick={onProjectStructureToggle}
          title="Toggle Project Structure"
        >
          <i className="fa-solid fa-folder-tree" />
        </button>
      </div>
      <div className="statusbar-right">
        <button
          className={`statusbar-button ${terminalOpen ? "active" : ""}`}
          onClick={onTerminalToggle}
          title="Toggle Terminal"
        >
          <i className="fa-solid fa-terminal" />
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
