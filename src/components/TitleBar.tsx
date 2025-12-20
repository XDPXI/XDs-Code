import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TitleBar() {
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
          XD's Code
        </div>
      </div>

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
}
