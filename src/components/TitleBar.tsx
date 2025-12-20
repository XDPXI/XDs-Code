import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div data-tauri-drag-region className="titlebar">
      <div className="titlebar-content">
        <div className="titlebar-title">XD's Code</div>
      </div>
      <div className="titlebar-buttons">
        <button
          className="titlebar-button minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <i className="fa-solid fa-minus" />
        </button>
        <button
          className="titlebar-button maximize"
          onClick={handleMaximize}
          aria-label="Maximize"
        >
          <i className="fa-regular fa-square" />
        </button>
        <button
          className="titlebar-button close"
          onClick={handleClose}
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
    </div>
  );
}
