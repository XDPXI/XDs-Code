import { useCallback } from "react";
import { detect } from "detect-browser";

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
  version: string;
}

export default function Settings({
  setShowSettings,
  version,
}: Readonly<SettingsProps>) {
  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, [setShowSettings]);

  const browser = detect();

  return (
    <div className="starter-screen">
      <h2 className="starter-title">Settings</h2>
      <div className="settings-info">
        <p>
          <strong>Name:</strong> XD's Code
        </p>
        <p>
          <strong>Version:</strong> {version || "Loading..."}
        </p>
        <p>
          <strong>Browser Name:</strong> {browser?.name ?? "Loading..."}
        </p>
        <p>
          <strong>Browser Type:</strong> {browser?.type ?? "Loading..."}
        </p>
        <p>
          <strong>Browser Version:</strong> {browser?.version ?? "Loading..."}
        </p>
        <p>
          <strong>Browser OS:</strong> {browser?.os ?? "Loading..."}
        </p>
      </div>
      <div className="settings-actions">
        <button className="starter-btn" onClick={handleCloseSettings}>
          Close Settings
        </button>
      </div>
    </div>
  );
}
