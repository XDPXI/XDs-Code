import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import './App.css';

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

    const isImageFile = (filename: string) => {
        return /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
    };
    const isVideoFile = (filename: string) => {
        return /\.(mp4|webm|ogg|mov)$/i.test(filename);
    };

    const openTab = useCallback((filename: string) => {
        if (!openTabs.includes(filename)) {
            setOpenTabs([...openTabs, filename]);
        }
        setCurrentFile(filename);
    }, [openTabs]);

    const closeTab = useCallback((filename: string) => {
        setOpenTabs(openTabs.filter((file) => file !== filename));
        if (currentFile === filename) {
            if (openTabs.length > 1) {
                setCurrentFile(openTabs[0]);
            } else {
                setCurrentFile(null);
                setFileContent('');
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
            const dirHandle = await (window as any).showDirectoryPicker();
            setDirStack([]);
            readDirectory(dirHandle);
        } catch (err) {
            console.error("Folder selection cancelled or unsupported", err);
        }
    }, [readDirectory]);

    const handleOpenFile = useCallback(async () => {
        try {
            const [fileHandle] = await (window as any).showOpenFilePicker();
            const file = await fileHandle.getFile();
            const content = await file.text();
            const newFile = {name: fileHandle.name, handle: fileHandle, content};
            setFileList([newFile]);
            setHasOpened(true);
            openTab(fileHandle.name);
        } catch (err) {
            console.error("File selection cancelled or unsupported", err);
        }
    }, [openTab]);

    const handleFileClick = useCallback(async (entry: Entry) => {
        if ('kind' in entry && entry.kind === 'directory') {
            setDirStack((prev) => [...prev, currentDirHandle!]);
            readDirectory(entry.handle);
        } else {
            setCurrentFile(entry.name);
            openTab(entry.name);

            // @ts-ignore
            const file = await entry.handle.getFile();

            if (isImageFile(entry.name) || isVideoFile(entry.name)) {
                const url = URL.createObjectURL(file);
                setMediaURL(url);
                setFileContent('');
            } else {
                // @ts-ignore
                setFileContent(entry.content);
                setMediaURL(null);
            }
        }
    }, [openTab, readDirectory, currentDirHandle]);

    const goBackDirectory = useCallback(() => {
        const newStack = [...dirStack];
        const parent = newStack.pop();
        if (parent) {
            setDirStack(newStack);
            readDirectory(parent);
        }
    }, [dirStack, readDirectory]);

    const handleSaveFile = useCallback(async () => {
        if (!currentFile) return;

        try {
            const fileEntry = fileList.find((f) => 'handle' in f && f.name === currentFile);
            if (!fileEntry || 'kind' in fileEntry) {
                console.error("File not found or is a folder:", currentFile);
                return;
            }

            const writable = await fileEntry.handle.createWritable();
            await writable.write(fileContent);
            await writable.close();
            console.log('File saved successfully');
        } catch (err) {
            console.error("Saving file failed", err);
        }
    }, [currentFile, fileContent, fileList]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSaveFile();
        }
    }, [handleSaveFile]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (currentFile) {
            const selectedFile = fileList.find((f) => f.name === currentFile && !('kind' in f));
            if (selectedFile) {
                setFileContent((selectedFile as FileEntry).content);
            }
        }
    }, [currentFile, fileList]);

    const fileItems = useMemo(() => {
        const items = [];

        if (dirStack.length > 0) {
            items.push(
                <div key="up" className="file-item" onClick={goBackDirectory}>
                    <i className="fa-solid fa-arrow-up"/> ..
                </div>
            );
        }

        for (const entry of fileList) {
            const isFolder = 'kind' in entry && entry.kind === 'directory';
            const icon = isFolder ? 'fa-solid fa-folder' : getFileIcon(entry.name);
            items.push(
                <div key={entry.name} className="file-item" onClick={() => handleFileClick(entry)}>
                    <i className={`file-icon ${icon}`}/> {entry.name}
                </div>
            );
        }

        return items;
    }, [fileList, handleFileClick, goBackDirectory, dirStack]);

    const tabItems = useMemo(() => openTabs.map((filename) => (
        <div key={filename} className={`tab-item ${currentFile === filename ? 'active' : ''}`}
             onClick={async () => {
                 setCurrentFile(filename);
                 const selectedFile = fileList.find((file) => file.name === filename && !('kind' in file));
                 if (selectedFile) {
                     // @ts-ignore
                     const file = await selectedFile.handle.getFile();

                     if (isImageFile(filename) || isVideoFile(filename)) {
                         const url = URL.createObjectURL(file);
                         setMediaURL(url);
                         setFileContent('');
                     } else {
                         const content = await file.text();
                         setFileContent(content);
                         setMediaURL(null);
                     }
                 }
             }}>
            {filename}
            <button className="close-tab-btn" onClick={(e) => {
                e.stopPropagation();
                closeTab(filename);
            }}>X
            </button>
        </div>
    )), [openTabs, currentFile, closeTab, fileList]);

    if (!hasOpened) {
        return (
            <div className="starter-screen">
                <h1 className="starter-title">XD’s Code</h1>
                <button className="starter-btn" onClick={handleOpenFolder}>📁 Open Folder</button>
                <button className="starter-btn" onClick={handleOpenFile}>📄 Open File</button>
            </div>
        );
    }

    return (
        <div className="editor-container">
            <div className="sidebar">
                <button className="open-folder-btn" onClick={handleOpenFolder}>📁 Open Folder</button>
                <button className="open-folder-btn" onClick={handleOpenFile}>📄 Open File</button>
                <div className="file-list">{fileItems}</div>
            </div>

            <div className="main-editor">
                <div className="tabs">{tabItems}</div>
                <div className="editor">
                    {!mediaURL && (
                        <div className="line-numbers">
                            {Array.from({length: 9999}, (_, i) => (
                                <div key={i} className="line-number">{i + 1}</div>
                            ))}
                        </div>
                    )}

                    {mediaURL && isImageFile(currentFile || '') && (
                        <div className="media-preview">
                            <img src={mediaURL} alt={currentFile || ''} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        </div>
                    )}

                    {mediaURL && isVideoFile(currentFile || '') && (
                        <div className="media-preview">
                            <video controls style={{ maxWidth: '100%', maxHeight: '100%' }}>
                                <source src={mediaURL} />
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
                            onChange={(e) => setFileContent(e.target.value)}
                            onScroll={(e) => {
                                const gutter = document.querySelector('.line-numbers');
                                if (gutter)
                                    gutter.scrollTop = (e.target as HTMLElement).scrollTop;
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
