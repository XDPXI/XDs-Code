import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import '../styles/globals.css';
import '../styles/fontawesome.css';
import Settings from "./Settings.tsx";
import {getVersion} from "@tauri-apps/api/app";
import Starter from "./Starter.tsx";
import Editor from "@monaco-editor/react";

interface FileEntry {
    name: string;
    handle: FileSystemFileHandle;
    content: string;
}

interface FolderEntry {
    name: string;
    handle: FileSystemDirectoryHandle;
    kind: 'directory';
}

type Entry = FileEntry | FolderEntry;

const getMonacoLanguage = (filename: string): string => {
    if (!filename) return "plaintext";
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "js":
        case "mjs":
        case "cjs":
            return "javascript";
        case "ts":
        case "tsx":
            return "typescript";
        case "jsx":
            return "javascript";
        case "html":
        case "htm":
            return "html";
        case "css":
        case "scss":
        case "less":
            return "css";
        case "json":
            return "json";
        case "md":
        case "markdown":
            return "markdown";
        case "py":
            return "python";
        case "c":
        case "cpp":
        case "h":
        case "hpp":
            return "cpp";
        case "cs":
            return "csharp";
        case "java":
            return "java";
        case "xml":
            return "xml";
        case "yaml":
        case "yml":
            return "yaml";
        default:
            return "plaintext";
    }
};

const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        // JavaScript/TypeScript
        case 'js':
        case 'mjs':
        case 'cjs':
        case 'ts':
            return 'fa-brands fa-js';
        case 'tsx':
        case 'jsx':
            return 'fa-brands fa-react';
        case 'vue':
            return 'fa-brands fa-vuejs';
        case 'angular':
        case 'ng':
            return 'fa-brands fa-angular';

        // Web Technologies
        case 'html':
        case 'htm':
            return 'fa-brands fa-html5';
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return 'fa-brands fa-css3-alt';
        case 'bootstrap':
            return 'fa-brands fa-bootstrap';

        // Programming Languages
        case 'java':
        case 'class':
        case 'jar':
            return 'fa-brands fa-java';
        case 'py':
        case 'pyc':
        case 'pyo':
        case 'pyw':
            return 'fa-brands fa-python';
        case 'php':
        case 'phtml':
            return 'fa-brands fa-php';
        case 'go':
        case 'mod':
            return 'fa-brands fa-golang';
        case 'rs':
        case 'toml':
            return 'fa-brands fa-rust';
        case 'swift':
            return 'fa-brands fa-swift';
        case 'rb':
        case 'ruby':
        case 'gem':
            return 'fa-solid fa-gem';
        case 'c':
        case 'h':
            return 'fa-solid fa-code';
        case 'cpp':
        case 'cxx':
        case 'cc':
        case 'hpp':
            return 'fa-solid fa-code';
        case 'cs':
            return 'fa-solid fa-code';
        case 'vb':
        case 'vbs':
            return 'fa-solid fa-code';
        case 'pl':
        case 'pm':
            return 'fa-solid fa-code';
        case 'sh':
        case 'bash':
        case 'zsh':
        case 'fish':
            return 'fa-solid fa-terminal';
        case 'bat':
        case 'cmd':
            return 'fa-solid fa-terminal';
        case 'ps1':
        case 'psm1':
            return 'fa-solid fa-terminal';
        case 'r':
        case 'rmd':
            return 'fa-brands fa-r-project';
        case 'scala':
            return 'fa-solid fa-code';
        case 'kt':
        case 'kts':
            return 'fa-solid fa-code';
        case 'dart':
            return 'fa-solid fa-code';
        case 'lua':
            return 'fa-solid fa-code';
        case 'erl':
        case 'hrl':
            return 'fa-brands fa-erlang';

        // Database
        case 'sql':
        case 'mysql':
        case 'pgsql':
        case 'sqlite':
        case 'db':
            return 'fa-solid fa-database';

        // Configuration Files
        case 'json':
        case 'jsonc':
        case 'xml':
        case 'xsl':
        case 'xsd':
            return 'fa-solid fa-code';
        case 'yaml':
        case 'yml':
            return 'fa-solid fa-file-lines';
        case 'ini':
        case 'cfg':
        case 'conf':
        case 'config':
            return 'fa-solid fa-gear';
        case 'env':
        case 'environment':
            return 'fa-solid fa-gear';
        case 'dockerignore':
        case 'dockerfile':
            return 'fa-brands fa-docker';

        // Version Control
        case 'gitignore':
        case 'gitattributes':
        case 'git':
            return 'fa-brands fa-git-alt';

        // Documentation
        case 'md':
        case 'markdown':
        case 'mdx':
            return 'fa-brands fa-markdown';
        case 'txt':
        case 'text':
            return 'fa-solid fa-file-lines';
        case 'rtf':
            return 'fa-solid fa-file-lines';
        case 'readme':
            return 'fa-solid fa-circle-info';
        case 'license':
        case 'licence':
            return 'fa-solid fa-scale-balanced';
        case 'changelog':
        case 'changes':
            return 'fa-solid fa-list';

        // Office Documents
        case 'doc':
        case 'docx':
            return 'fa-brands fa-microsoft';
        case 'xls':
        case 'xlsx':
        case 'csv':
            return 'fa-solid fa-file-excel';
        case 'ppt':
        case 'pptx':
            return 'fa-solid fa-file-powerpoint';
        case 'pdf':
            return 'fa-solid fa-file-pdf';
        case 'odt':
        case 'ods':
        case 'odp':
            return 'fa-solid fa-file-lines';

        // Images
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'bmp':
        case 'tiff':
        case 'tif':
        case 'webp':
        case 'avif':
        case 'heic':
        case 'heif':
            return 'fa-regular fa-image';
        case 'svg':
            return 'fa-solid fa-vector-square';
        case 'ico':
        case 'icns':
            return 'fa-solid fa-icons';
        case 'psd':
        case 'ai':
        case 'eps':
            return 'fa-solid fa-paintbrush';
        case 'fig':
        case 'figma':
            return 'fa-brands fa-figma';
        case 'sketch':
            return 'fa-brands fa-sketch';

        // Audio
        case 'mp3':
        case 'wav':
        case 'flac':
        case 'aac':
        case 'ogg':
        case 'wma':
        case 'm4a':
        case 'opus':
            return 'fa-solid fa-music';

        // Video
        case 'mp4':
        case 'avi':
        case 'mkv':
        case 'mov':
        case 'wmv':
        case 'flv':
        case 'webm':
        case 'm4v':
        case '3gp':
        case 'ogv':
            return 'fa-solid fa-film';

        // Archives
        case 'zip':
        case '7z':
        case 'rar':
        case 'tar':
        case 'gz':
        case 'bz2':
        case 'xz':
        case 'z':
        case 'lz':
        case 'lzma':
        case 'cab':
        case 'deb':
        case 'rpm':
        case 'dmg':
        case 'pkg':
        case 'msi':
        case 'exe':
        case 'app':
            return 'fa-solid fa-file-zipper';

        // Fonts
        case 'ttf':
        case 'otf':
        case 'woff':
        case 'woff2':
        case 'eot':
            return 'fa-solid fa-font';

        // 3D/CAD
        case 'obj':
        case 'fbx':
        case 'dae':
        case 'gltf':
        case 'glb':
        case '3ds':
        case 'blend':
        case 'max':
        case 'maya':
        case 'dwg':
        case 'dxf':
            return 'fa-solid fa-cube';

        // Package Managers
        case 'npm':
        case 'yarn':
            return 'fa-brands fa-npm';
        case 'composer':
            return 'fa-solid fa-box';
        case 'pip':
        case 'pipfile':
            return 'fa-brands fa-python';
        case 'cargo':
            return 'fa-brands fa-rust';
        case 'gemfile':
            return 'fa-solid fa-gem';
        case 'podfile':
            return 'fa-solid fa-box';

        // Build/Task Files
        case 'makefile':
        case 'make':
            return 'fa-solid fa-hammer';
        case 'cmake':
            return 'fa-solid fa-hammer';
        case 'gradle':
            return 'fa-solid fa-hammer';
        case 'gulpfile':
        case 'gruntfile':
            return 'fa-solid fa-hammer';
        case 'webpack':
            return 'fa-solid fa-cube';
        case 'rollup':
        case 'vite':
            return 'fa-solid fa-cube';

        // Certificates/Keys
        case 'pem':
        case 'crt':
        case 'cert':
        case 'cer':
        case 'p12':
        case 'pfx':
        case 'key':
        case 'pub':
            return 'fa-solid fa-key';

        // Log Files
        case 'log':
        case 'logs':
            return 'fa-solid fa-file-lines';

        // Temporary/Cache
        case 'tmp':
        case 'temp':
        case 'cache':
        case 'bak':
        case 'backup':
        case 'old':
            return 'fa-solid fa-clock-rotate-left';

        // Default
        default:
            return 'fa-regular fa-file';
    }
};

export default function App() {
    const [fileList, setFileList] = useState<Entry[]>([]);
    const [openTabs, setOpenTabs] = useState<string[]>([]);
    const [hasOpened, setHasOpened] = useState<boolean>(false);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [currentDirHandle, setCurrentDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [dirStack, setDirStack] = useState<FileSystemDirectoryHandle[]>([]);
    const [mediaURL, setMediaURL] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [version, setVersion] = useState("0.0.0")
    const contentRef = useRef<string>('');
    const isDirtyRef = useRef<boolean>(false);

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

    const isImageFile = (filename: string) => {
        return /\.(png|ico|icns|jpe?g|gif|webp|svg)$/i.test(filename);
    };
    const isVideoFile = (filename: string) => {
        return /\.(mp4|webm|ogg|mov)$/i.test(filename);
    };

    const handleOpenSettings = useCallback(() => {
        setShowSettings(true);
    }, []);

    const openTab = useCallback((filename: string) => {
        if (!openTabs.includes(filename)) {
            setOpenTabs([...openTabs, filename]);
        }
        setCurrentFile(filename);
    }, [openTabs]);

    const closeTab = useCallback((filename: string | null) => {
        setOpenTabs(openTabs.filter((file) => file !== filename));
        if (currentFile === filename) {
            if (openTabs.length > 1) {
                const newCurrentFile = openTabs.find(tab => tab !== filename) ?? null;
                setCurrentFile(newCurrentFile);
            } else {
                setCurrentFile(null);
                setFileContent('');
                contentRef.current = '';
            }
        }
    }, [openTabs, currentFile]);

    const readDirectory = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
        const entries: Entry[] = [];

        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const content = await file.text();
                entries.push({name: entry.name, handle: entry, content});
            } else if (entry.kind === 'directory') {
                entries.push({name: entry.name, handle: entry, kind: 'directory'});
            }
        }

        entries.sort((a, b) => {
            if ('kind' in a && a.kind === 'directory') return -1;
            if ('kind' in b && b.kind === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        setFileList(entries);
        setCurrentDirHandle(dirHandle);
        setHasOpened(true);
    }, []);

    const handleOpenFolder = useCallback(async () => {
        try {
            if ('showDirectoryPicker' in window) {
                const dirHandle = await (window as any).showDirectoryPicker();
                setDirStack([]);
                await readDirectory(dirHandle);
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                (input as any).directory = true;
                input.multiple = true;

                input.onchange = async (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    if (files.length === 0) return;

                    const entries: Entry[] = [];
                    const dirName = files[0].webkitRelativePath.split('/')[0];

                    for (const file of files) {
                        if (file.name === dirName) continue;

                        const content = await file.text();
                        const virtualHandle = {
                            getFile: async () => file,
                            createWritable: async () => {
                                throw new Error("Write operations not supported in compatibility mode");
                            }
                        } as unknown as FileSystemFileHandle;

                        entries.push({
                            name: file.name,
                            handle: virtualHandle,
                            content
                        });
                    }

                    entries.sort((a, b) => {
                        if ('kind' in a && a.kind === 'directory') return -1;
                        if ('kind' in b && b.kind === 'directory') return 1;
                        return a.name.localeCompare(b.name);
                    });

                    setFileList(entries);
                    setDirStack([]);
                    setHasOpened(true);

                    const virtualDirHandle = {
                        name: dirName,
                        kind: 'directory'
                    } as unknown as FileSystemDirectoryHandle;

                    setCurrentDirHandle(virtualDirHandle);
                };

                input.click();
            }
        } catch (err) {
            console.error("Folder selection cancelled or unsupported", err);
            alert("Your browser may not fully support folder selection. For the best experience, please use Chrome or Edge.");
        }
    }, [readDirectory]);

    const handleFileClick = useCallback(async (entry: Entry) => {
        if (isDirtyRef.current && currentFile) {
            const confirmSave = window.confirm("You have unsaved changes. Do you want to save them before opening another file?");
            if (confirmSave) {
                await handleSaveFile();
            }
            isDirtyRef.current = false;
        }

        if ('kind' in entry && entry.kind === 'directory') {
            setDirStack((prev) => [...prev, currentDirHandle!]);
            await readDirectory(entry.handle);
        } else {
            setCurrentFile(entry.name);
            openTab(entry.name);

            // @ts-ignore
            const file = await entry.handle.getFile();

            if (isImageFile(entry.name) || isVideoFile(entry.name)) {
                const url = URL.createObjectURL(file);
                setMediaURL(url);
                setFileContent('');
                contentRef.current = '';
            } else {
                // @ts-ignore
                const content = entry.content;
                contentRef.current = content;
                setFileContent(content);
                setMediaURL(null);
            }
        }
    }, [openTab, readDirectory, currentDirHandle, currentFile]);

    const goBackDirectory = useCallback(() => {
        const newStack = [...dirStack];
        const parent = newStack.pop();
        if (parent) {
            setDirStack(newStack);
            readDirectory(parent);
        }
    }, [dirStack, readDirectory]);

    const handleSaveFile = useCallback(async () => {
        if (!currentFile) {
            console.error("No file to save");
            return;
        }

        try {
            const fileEntry = fileList.find((f) => 'handle' in f && f.name === currentFile);
            if (!fileEntry || 'kind' in fileEntry) {
                console.error("File not found or is a folder:", currentFile);
                return;
            }

            const contentToSave = contentRef.current;

            const writable = await fileEntry.handle.createWritable();
            await writable.write(contentToSave);
            await writable.close();

            setFileList(prev =>
                prev.map(entry =>
                    'handle' in entry && entry.name === currentFile
                        ? {...entry, content: contentToSave}
                        : entry
                )
            );

            isDirtyRef.current = false;
            console.log('File saved successfully');
        } catch (err) {
            console.error("Saving file failed", err);
        }
    }, [currentFile, fileList]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 's' || e.metaKey && e.key === 's') {
            e.preventDefault();
            handleSaveFile();
        }
        if (e.ctrlKey && e.key === 'w' || e.metaKey && e.key === 'w') {
            e.preventDefault();
            closeTab(currentFile);
        }
    }, [handleSaveFile, closeTab]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (currentFile) {
            const selectedFile = fileList.find((f) => f.name === currentFile && !('kind' in f));
            if (selectedFile) {
                const content = (selectedFile as FileEntry).content;
                contentRef.current = content;
                setFileContent(content);
                isDirtyRef.current = false;
            }
        }
    }, [currentFile, fileList]);

    const fileItems = useMemo(() => {
        const items = [];

        if (dirStack.length > 0) {
            items.push(
                <button
                    key="up"
                    className="file-item"
                    onClick={goBackDirectory}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goBackDirectory();
                        }
                    }}
                    type="button"
                    aria-label="Go to parent directory"
                >
                    <i className="fa-solid fa-arrow-up"/> ..
                </button>
            );
        }

        for (const entry of fileList) {
            const isFolder = 'kind' in entry && entry.kind === 'directory';
            const icon = isFolder ? 'fa-solid fa-folder' : getFileIcon(entry.name);
            items.push(
                <button
                    key={entry.name}
                    className="file-item"
                    onClick={() => handleFileClick(entry)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleFileClick(entry);
                        }
                    }}
                    type="button"
                    aria-label={isFolder ? `Open folder ${entry.name}` : `Open file ${entry.name}`}
                >
                    <i className={`file-icon ${icon}`}/> {entry.name}
                </button>
            );
        }

        return items;
    }, [fileList, handleFileClick, goBackDirectory, dirStack]);

    useEffect(() => {
        const lineNumbers = document.getElementById('lineNumbers');
        const fileContents = document.getElementById('fileContents');

        if (currentFile === null && (lineNumbers && fileContents)) {
            lineNumbers.style.display = 'none';
            fileContents.style.display = 'none';
        } else if (currentFile && (lineNumbers && fileContents)) {
            lineNumbers.style.display = 'block';
            fileContents.style.display = 'block';
        }
    }, [currentFile])

    const handleTabClick = useCallback(async (filename: string) => {
        if (isDirtyRef.current && currentFile && currentFile !== filename) {
            const confirmSave = window.confirm("You have unsaved changes. Do you want to save them before switching tabs?");
            if (confirmSave) {
                await handleSaveFile();
            }
            isDirtyRef.current = false;
        }

        setCurrentFile(filename);
        const selectedFile = fileList.find((file) => file.name === filename && !('kind' in file));
        if (!selectedFile) return;

        // @ts-ignore
        const file = await selectedFile.handle.getFile();

        if (isImageFile(filename) || isVideoFile(filename)) {
            const url = URL.createObjectURL(file);
            setMediaURL(url);
            setFileContent('');
            contentRef.current = '';
        } else {
            const content = await file.text();
            contentRef.current = content;
            setFileContent(content);
            setMediaURL(null);
        }
    }, [currentFile, fileList, handleSaveFile]);

    const tabItems = useMemo(() => openTabs.map((filename) => (
        <button
            key={filename}
            className={`tab-item ${currentFile === filename ? 'active' : ''}`}
            onClick={() => handleTabClick(filename)}
            onMouseDown={(e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    closeTab(filename);
                }
            }}
            type="button"
            role="tab"
            aria-selected={currentFile === filename}
        >
            {filename}
            <button
                className="close-tab-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    closeTab(filename);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        closeTab(filename);
                    }
                }}
                aria-label={`Close ${filename} tab`}
                tabIndex={0}
                type="button"
            >
                X
            </button>
        </button>
    )), [openTabs, currentFile, closeTab, fileList, handleSaveFile]);

    if (showSettings) {
        return <Settings setShowSettings={setShowSettings} version={version}/>;
    } else if (!hasOpened) {
        return <Starter handleOpenFolder={handleOpenFolder} handleOpenSettings={handleOpenSettings}/>;
    }

    return (
        <div className="editor-container">
            <div className="sidebar">
                <button className="open-folder-btn" onClick={handleOpenFolder}>📁 Open Folder</button>
                <button className="open-folder-btn" onClick={handleOpenSettings}>⚙️ Settings</button>
                <div className="file-list">{fileItems}</div>
            </div>

            <div className="main-editor">
                <div className="tabs">{tabItems}</div>
                <div className="editor">
                    {mediaURL && isImageFile(currentFile ?? '') && (
                        <div className="media-preview">
                            <img src={mediaURL} alt={currentFile ?? ''} style={{maxWidth: '100%', maxHeight: '100%'}}/>
                        </div>
                    )}

                    {mediaURL && isVideoFile(currentFile ?? '') && (
                        <div className="media-preview">
                            <video controls style={{maxWidth: '100%', maxHeight: '100%'}}>
                                <source src={mediaURL}/>
                                <track kind="captions" src="" label="English" srcLang="en" default/>
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    )}

                    {!mediaURL && (
                        <Editor
                            height="100%"
                            language={getMonacoLanguage(currentFile || "")}
                            value={fileContent}
                            onChange={(value) => {
                                contentRef.current = value || "";
                                setFileContent(value || "");
                                isDirtyRef.current = true;
                            }}
                            theme="vs-dark"
                            options={{
                                fontFamily: "JetBrains Mono, Fira Code, monospace",
                                fontSize: 14,
                                minimap: { enabled: false },
                                wordWrap: "on",
                                scrollBeyondLastLine: false,
                                lineNumbers: "on",
                                renderLineHighlight: "all",
                                automaticLayout: true,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
