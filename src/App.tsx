import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import './App.css';

interface FileEntry {
    name: string;
    handle: FileSystemFileHandle;
    content: string;
}

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
    const [fileList, setFileList] = useState<FileEntry[]>([]);
    const [openTabs, setOpenTabs] = useState<string[]>([]);
    const [hasOpened, setHasOpened] = useState<boolean>(false);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const editorRef = useRef<HTMLTextAreaElement>(null);

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

    const handleOpenFolder = useCallback(async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            const files: FileEntry[] = [];

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    const content = await file.text();
                    files.push({name: entry.name, handle: entry, content});
                }
            }

            setFileList(files);
            setHasOpened(true);
        } catch (err) {
            console.error("Folder selection cancelled or unsupported", err);
        }
    }, []);

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

    const handleFileClick = useCallback(async (file: string) => {
        setCurrentFile(file);
        const selectedFile = fileList.find((f) => f.name === file);

        if (selectedFile) {
            setFileContent(selectedFile.content);
            openTab(file);
        } else {
            console.warn("File not found in fileList:", file);
            setFileContent(`File not found: ${file}`);
        }
    }, [fileList, openTab]);

    const handleSaveFile = useCallback(async () => {
        if (!currentFile) return;

        try {
            const fileEntry = fileList.find((f) => f.name === currentFile);
            if (!fileEntry) {
                console.error("File not found in fileList:", currentFile);
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
            const selectedFile = fileList.find((f) => f.name === currentFile);
            if (selectedFile) {
                setFileContent(selectedFile.content);
            }
        }
    }, [currentFile, fileList]);

    const fileItems = useMemo(() => fileList.map((file, index) => (
        <div key={index} className="file-item" onClick={() => handleFileClick(file.name)}>
            <i className={`file-icon ${getFileIcon(file.name)}`}/> {file.name}
        </div>
    )), [fileList, handleFileClick]);

    const tabItems = useMemo(() => openTabs.map((filename) => (
        <div key={filename} className={`tab-item ${currentFile === filename ? 'active' : ''}`}
             onClick={() => {
                 setCurrentFile(filename);
                 const selectedFile = fileList.find((file) => file.name === filename);
                 if (selectedFile) {
                     setFileContent(selectedFile.content);
                 }
             }}>
            {filename}
            <button className="close-tab-btn" onClick={(e) => {
                e.stopPropagation();
                closeTab(filename);
            }}>X</button>
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
                    <div className="line-numbers">
                        {Array.from({length: 999}, (_, i) => (
                            <div key={i} className="line-number">{i + 1}</div>
                        ))}
                    </div>
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
                </div>
            </div>
        </div>
    );
}
