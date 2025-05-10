import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import './App.css';
import Settings from "./Settings.tsx";
import Starter from "./Starter.tsx";

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

const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'ts':
            return 'fa-brands fa-js';
        case 'html':
            return 'fa-brands fa-html5';
        case 'css':
            return 'fa-brands fa-css3-alt';
        case 'md':
            return 'fa-solid fa-file-lines';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'ico':
        case 'icns':
        case 'webp':
        case 'svg':
            return 'fa-regular fa-image';
        case 'mp3':
        case 'wav':
            return 'fa-solid fa-music';
        case 'mp4':
        case 'webm':
            return 'fa-solid fa-film';
        case 'zip':
        case 'rar':
            return 'fa-solid fa-file-zipper';
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
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const [mediaURL, setMediaURL] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const contentRef = useRef<string>('');
    const isDirtyRef = useRef<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
    const [totalFiles, setTotalFiles] = useState<number>(0);
    const [currentlyLoading, setCurrentlyLoading] = useState<string>('');
    const [loadingDots, setLoadingDots] = useState<string>('');

    useEffect(() => {
        if (isLoading) {
            const dotsInterval = setInterval(() => {
                setLoadingDots(prev => {
                    switch (prev) {
                        case '':
                            return '.';
                        case '.':
                            return '..';
                        case '..':
                            return '...';
                        case '...':
                            return '';
                        default:
                            return '';
                    }
                });
            }, 500);

            return () => clearInterval(dotsInterval);
        } else {
            setLoadingDots('');
        }
    }, [isLoading]);

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
        setIsLoading(true);
        setLoadedFiles([]);

        const entries: Entry[] = [];
        let fileCount = 0;

        try {
            // @ts-ignore
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    fileCount++;
                }
            }

            setTotalFiles(fileCount);

            // @ts-ignore
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    setCurrentlyLoading(entry.name);
                    const file = await entry.getFile();
                    const content = await file.text();
                    entries.push({name: entry.name, handle: entry, content});
                    setLoadedFiles(prev => [...prev, entry.name]);
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
        } catch (error) {
            console.error("Error reading directory:", error);
        } finally {
            setTimeout(() => {
                setIsLoading(false);
                setLoadedFiles([]);
                setCurrentlyLoading('');
            }, 500);
        }
    }, []);

    const handleOpenFolder = useCallback(async () => {
        try {
            if ('showDirectoryPicker' in window) {
                setIsLoading(true);
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
                    setIsLoading(true);
                    setLoadedFiles([]);

                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    if (files.length === 0) {
                        setIsLoading(false);
                        return;
                    }

                    const entries: Entry[] = [];
                    const dirName = files[0].webkitRelativePath.split('/')[0];
                    setTotalFiles(files.length - 1);

                    try {
                    for (const file of files) {
                        if (file.name === dirName) continue;

                        setCurrentlyLoading(file.name);
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

                        setLoadedFiles(prev => [...prev, file.name]);
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
                    } catch (error) {
                        console.error("Error processing files:", error);
                    } finally {
                        setTimeout(() => {
                            setIsLoading(false);
                            setLoadedFiles([]);
                            setCurrentlyLoading('');
                        }, 500);
                    }
                };

                input.click();
            }
        } catch (err) {
            console.error("Folder selection cancelled or unsupported", err);
            alert("Your browser may not fully support folder selection. For the best experience, please use Chrome or Edge.");
            setIsLoading(false);
        }
    }, [readDirectory]);

    const handleFileClick = useCallback(async (entry: Entry) => {
        if (isLoading) return;

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
    }, [openTab, readDirectory, currentDirHandle, currentFile, isLoading]);

    const goBackDirectory = useCallback(() => {
        if (isLoading) return;

        const newStack = [...dirStack];
        const parent = newStack.pop();
        if (parent) {
            setDirStack(newStack);
            readDirectory(parent);
        }
    }, [dirStack, readDirectory, isLoading]);

    const handleSaveFile = useCallback(async () => {
        if (!currentFile || isLoading) {
            console.error("No file to save or loading is in progress");
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
    }, [currentFile, fileList, isLoading]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (isLoading) return;

        if (e.ctrlKey && e.key === 's' || e.metaKey && e.key === 's') {
            e.preventDefault();
            handleSaveFile();
        }
        if (e.ctrlKey && e.key === 'w' || e.metaKey && e.key === 'w') {
            e.preventDefault();
            closeTab(currentFile);
        }
    }, [handleSaveFile, closeTab, isLoading]);

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

    const handleEditorChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isLoading) return;

        const newContent = e.target.value;
        contentRef.current = newContent;
        isDirtyRef.current = true;

        requestAnimationFrame(() => {
            setFileContent(newContent);
        });
    }, [isLoading]);

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
        return <Settings setShowSettings={setShowSettings}/>;
    } else if (!hasOpened) {
        return <Starter handleOpenFolder={handleOpenFolder} handleOpenSettings={handleOpenSettings}/>;
    }

    return (
        <div className="editor-container">
            <div className={`sidebar ${isLoading ? 'disabled-ui' : ''}`}>
                <button className="open-folder-btn" onClick={handleOpenFolder}>📁 Open Folder</button>
                <button className="open-folder-btn" onClick={handleOpenSettings}>⚙️ Settings</button>
                <div className="file-list">{fileItems}</div>
            </div>

            <div className={`main-editor ${isLoading ? 'disabled-ui' : ''}`}>
                <div className="tabs">{tabItems}</div>
                <div className="editor">
                    {!mediaURL && (
                        <div id="lineNumbers" className="line-numbers">
                            {Array.from({length: fileContent.split('\n').length}, (_, i) => (
                                <div key={i} className="line-number">{i + 1}</div>
                            ))}
                        </div>
                    )}

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
                        <textarea
                            ref={editorRef}
                            className="editor-textarea"
                            spellCheck={false}
                            autoFocus
                            value={fileContent}
                            onChange={handleEditorChange}
                            id="fileContents"
                            onScroll={(e) => {
                                const gutter = document.querySelector('.line-numbers');
                                if (gutter)
                                    gutter.scrollTop = (e.target as HTMLElement).scrollTop;
                            }}
                        />
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <div>Loading folder contents{loadingDots}</div>
                    <div className="loading-progress">
                        {loadedFiles.length} of {totalFiles} files loaded
                    </div>
                    {currentlyLoading && (
                        <div>Currently loading: {currentlyLoading}</div>
                    )}
                    <div className="loading-files-list">
                        {loadedFiles.slice(-10).map((file, index) => (
                            <div key={index}>Loaded: {file}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
