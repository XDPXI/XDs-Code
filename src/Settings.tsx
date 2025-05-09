import {useCallback, useEffect, useState} from "react";
import {detect} from "detect-browser";
import * as pjson from "pjson";

interface SettingsProps {
    setShowSettings: (show: boolean) => void;
}

export default function Settings({setShowSettings}: SettingsProps) {
    const handleCloseSettings = useCallback(() => {
        setDownloadingApp(false)
        setShowSettings(false);
    }, [setShowSettings]);

    const [downloadingApp, setDownloadingApp] = useState<boolean>(false);
    const downloadApp = useCallback(() => {
        setDownloadingApp(true)
    }, []);

    const browser = detect();

    const [sha, setSha] = useState<string | null>(null);
    useEffect(() => {
        const fetchCommitSHA = async () => {
            try {
                const response = await fetch(
                    'https://api.github.com/repos/XDPXI/XDs-Code/commits?sha=website'
                );
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    setSha(data[0].sha.slice(0, 7));
                }
            } catch (error) {
                console.error('Error fetching commit SHA:', error);
            }
        };

        fetchCommitSHA();
    }, []);

    const download = useCallback((platform: String) => {
        switch (platform) {
            case 'mac-apple-silicone':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${pjson.version}_aarch64-macos.dmg`;
                break;
            case 'mac-intel':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${pjson.version}_x86-64-macos.dmg`;
                break;
            case 'windows':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${pjson.version}_x86-64-macos.dmg`;
                break;
            default:
                console.error(`Unsupported platform: ${platform}`);
        }

        const downloadButtons = document.getElementById('downloadButtons');
        const downloadTitle = document.getElementById('downloadTitle');

        if (downloadButtons) {
            downloadButtons.style.display = 'none';
        }
        if (downloadTitle) {
            downloadTitle.textContent = 'Thank you for downloading!';
        }
    }, []);

    if (downloadingApp) {
        return (
            <div className="starter-screen">
                <h2 id="downloadTitle" className="starter-title">Download</h2>
                <div id="downloadButtons" className="settings-actions">
                    <button className="starter-btn" onClick={() => download("mac-apple-silicone")}>MacOS (Apple Silicone)</button>
                    <button className="starter-btn" onClick={() => download("mac-intel")}>MacOS (Intel)</button>
                    <button className="starter-btn" onClick={() => download("windows")}>Windows</button>
                </div>
                <div className="settings-actions">
                    <button className="starter-btn" onClick={handleCloseSettings}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="starter-screen">
            <h2 className="starter-title">Settings</h2>
            <div className="settings-info">
                <p><strong>Name:</strong> XD's Code</p>
                <p><strong>Version:</strong> <a href={`https://github.com/XDPXI/XDs-Code/commit/${sha}`}>{sha || "Loading..."}</a></p>
                <p><strong>Browser Name:</strong> {browser?.name || "Loading..."}</p>
                <p><strong>Browser Type:</strong> {browser?.type || "Loading..."}</p>
                <p><strong>Browser Version:</strong> {browser?.version || "Loading..."}</p>
                <p><strong>Browser OS:</strong> {browser?.os || "Loading..."}</p>
            </div>
            <div className="settings-actions">
                <button className="starter-btn" onClick={downloadApp}>Download App</button>
                <button className="starter-btn" onClick={handleCloseSettings}>Close Settings</button>
            </div>
        </div>
    );
}