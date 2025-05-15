import {useCallback, useEffect, useState} from "react";
import {detect} from "detect-browser";

interface SettingsProps {
    setShowSettings: (show: boolean) => void;
}

interface ExcludeSettings {
    executables: boolean;
    archives: boolean;
    hidden: boolean;
    nodeModules: boolean;
    gitFolders: boolean;
}

export default function Settings({setShowSettings}: Readonly<SettingsProps>) {
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
    const [excludes, setExcludes] = useState<ExcludeSettings>({
        executables: true,
        archives: false,
        hidden: true,
        nodeModules: true,
        gitFolders: true
    });

    useEffect(() => {
        const loadSettings = () => {
            const savedExcludes = getCookie('excludes');
            if (savedExcludes) {
                try {
                    setExcludes(JSON.parse(savedExcludes));
                } catch (e) {
                    console.error('Error parsing excludes from cookie:', e);
                }
            }
        };

        loadSettings();
    }, []);

    const saveSettings = (newExcludes?: ExcludeSettings) => {
        const excludesToSave = newExcludes || excludes;

        setCookie('excludes', JSON.stringify(excludesToSave), 365);
    };

    const setCookie = (name: string, value: string, days: number) => {
        const expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    };

    const getCookie = (name: string): string | null => {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (const element of ca) {
            let c = element;
            while (c.startsWith(" ")) c = c.substring(1, c.length);
            if (c.startsWith(nameEQ)) return c.substring(nameEQ.length, c.length);
        }
        return null;
    };

    const toggleExclude = (key: keyof ExcludeSettings) => {
        const newExcludes = {
            ...excludes,
            [key]: !excludes[key]
        };
        setExcludes(newExcludes);
        saveSettings(undefined);
    };

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

    const download = useCallback((platform: string) => {
        const version = "0.5.0"

        switch (platform) {
            case 'mac-apple-silicone':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${version}_aarch64-macos.dmg`;
                break;
            case 'mac-intel':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${version}_x86-64-macos.dmg`;
                break;
            case 'windows':
                window.location.href = `https://github.com/XDPXI/XDs-Code/releases/latest/download/xds-code_${version}_x86-64-windows.exe`;
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
                    <button className="starter-btn" onClick={() => download("mac-apple-silicone")}>MacOS (Apple
                        Silicone)
                    </button>
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
                <h3>File Excludes</h3>
                <div className="settings-option">
                    <label htmlFor="excludeExecutables">Exclude Executables</label>
                    <button
                        id="excludeExecutables"
                        className="toggle-btn"
                        onClick={() => toggleExclude('executables')}
                        style={{
                            backgroundColor: excludes.executables ? '#4CAF50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        {excludes.executables ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="settings-option">
                    <label htmlFor="excludeArchives">Exclude Archives</label>
                    <button
                        id="excludeArchives"
                        className="toggle-btn"
                        onClick={() => toggleExclude('archives')}
                        style={{
                            backgroundColor: excludes.archives ? '#4CAF50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        {excludes.archives ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="settings-option">
                    <label htmlFor="excludeHidden">Exclude Hidden Files</label>
                    <button
                        id="excludeHidden"
                        className="toggle-btn"
                        onClick={() => toggleExclude('hidden')}
                        style={{
                            backgroundColor: excludes.hidden ? '#4CAF50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        {excludes.hidden ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="settings-option">
                    <label htmlFor="excludeNodeModules">Exclude node_modules</label>
                    <button
                        id="excludeNodeModules"
                        className="toggle-btn"
                        onClick={() => toggleExclude('nodeModules')}
                        style={{
                            backgroundColor: excludes.nodeModules ? '#4CAF50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        {excludes.nodeModules ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="settings-option">
                    <label htmlFor="excludeGitFolders">Exclude .git Folders</label>
                    <button
                        id="excludeGitFolders"
                        className="toggle-btn"
                        onClick={() => toggleExclude('gitFolders')}
                        style={{
                            backgroundColor: excludes.gitFolders ? '#4CAF50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                        }}
                    >
                        {excludes.gitFolders ? 'On' : 'Off'}
                    </button>
                </div>
            </div>

            <div className="settings-info">
                <p><strong>Name:</strong> XD's Code</p>
                <p><strong>Version:</strong> <a
                    href={`https://github.com/XDPXI/XDs-Code/commit/${sha}`}>{sha ?? "Loading..."}</a></p>
                <p><strong>Browser Name:</strong> {browser?.name ?? "Loading..."}</p>
                <p><strong>Browser Type:</strong> {browser?.type ?? "Loading..."}</p>
                <p><strong>Browser Version:</strong> {browser?.version ?? "Loading..."}</p>
                <p><strong>Browser OS:</strong> {browser?.os ?? "Loading..."}</p>
            </div>
            <div className="settings-actions">
                <button className="starter-btn" onClick={downloadApp}>Download App</button>
                <button className="starter-btn" onClick={handleCloseSettings}>Close Settings</button>
            </div>
        </div>
    );
}