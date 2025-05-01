import { useCallback, useState, useEffect } from "react";
import { getVersion } from '@tauri-apps/api/app';

interface SettingsProps {
  setShowSettings: (show: boolean) => void;
}

export default function Settings({ setShowSettings }: SettingsProps) {
    const [version, setVersion] = useState("N/A");
    
    useEffect(() => {
        const fetchVersion = async () => {
            try {
                const appVersion = await getVersion();
                setVersion(appVersion);
            } catch (error) {
                console.error("Failed to get app version:", error);
                setVersion("N/A");
            }
        };
        
        fetchVersion();
    }, []);

    const handleCloseSettings = useCallback(() => {
        setShowSettings(false);
    }, [setShowSettings]);

    return (
        <div className="starter-screen">
            <h2 className="starter-title">Settings</h2>
            <div className="settings-info">
                <p><strong>Name:</strong> XD's Code</p>
                <p><strong>Version:</strong> {version}</p>
            </div>
            <div className="settings-actions">
                <button className="starter-btn" onClick={handleCloseSettings}>Close Settings</button>
            </div>
        </div>
    );
}