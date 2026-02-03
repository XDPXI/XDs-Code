import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";

interface TitleBarProps {
  handleOpenFolder: () => void;
  selectedDir: string;
}

const TitleBar: React.FC<TitleBarProps> = ({
  handleOpenFolder,
  selectedDir,
}) => {
  const appWindow = getCurrentWindow();

  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-content" data-tauri-drag-region>
        <div className="titlebar-title" data-tauri-drag-region>
          <img
            src="/icon.png"
            className="titlebar-icon"
            data-tauri-drag-region
          />
        </div>
      </div>

      {selectedDir != "null" && (
        <button className="titlebar-open-folder-btn" onClick={handleOpenFolder}>
          {selectedDir}
        </button>
      )}

      <div className="titlebar-buttons" data-tauri-drag-region="false">
        <button className="titlebar-button minimize" onClick={handleMinimize}>
          <i className="fa-solid fa-minus" />
        </button>

        <button className="titlebar-button maximize" onClick={handleMaximize}>
          <i className="fa-regular fa-square" />
        </button>

        <button className="titlebar-button close" onClick={handleClose}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
