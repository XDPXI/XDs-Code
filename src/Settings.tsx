import {useCallback} from "react";

interface SettingsProps {
    setShowSettings: (show: boolean) => void;
    version: string;
}

export default function Settings({setShowSettings, version}: SettingsProps) {
    const handleCloseSettings = useCallback(() => {
        setShowSettings(false);
    }, [setShowSettings]);

    const downloadInstaller = () => {
        window.location.href = `https://github.com/XDPXI/XDs-Code/releases/download/${version}/xds-code_installer_${version}_windows.exe`;
    };

    return (
        <div className="starter-screen">
            <h2 className="starter-title">Settings</h2>
            <div className="settings-info">
                <p><strong>Name:</strong> XD's Code</p>
                <p><strong>Version:</strong> {version}</p>
            </div>
            <div className="settings-actions">
                <button className="starter-btn" onClick={downloadInstaller}>Download Uninstaller</button>
            </div>
            <div className="settings-actions">
                <button className="starter-btn" onClick={handleCloseSettings}>Close Settings</button>
            </div>
        </div>
    );
}