import {useEffect, useRef, useState} from 'react';
import './App.css';

const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'ts':
            return 'fa-brands fa-js';
        case 'json':
            return 'fa-solid fa-brackets-curly';
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
    const [fileList, setFileList] = useState<string[]>([]);
    const [hasOpened, setHasOpened] = useState<boolean>(false);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const editorRef = useRef<HTMLTextAreaElement>(null);

    const handleOpenFolder = async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            const files: string[] = [];

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') files.push(entry.name);
            }

            setFileList(files);
            setHasOpened(true);
        } catch (err) {
            console.error("Folder selection cancelled or unsupported", err);
        }
    };

    const handleOpenFile = async () => {
        try {
            const [fileHandle] = await (window as any).showOpenFilePicker();
            setFileList([fileHandle.name]);
            setHasOpened(true);
            setCurrentFile(fileHandle.name);

            const file = await fileHandle.getFile();
            const text = await file.text();
            setFileContent(text);
        } catch (err) {
            console.error("File selection cancelled or unsupported", err);
        }
    };

    const handleFileClick = async (file: string) => {
        setCurrentFile(file);
        const fileHandle = await (window as any).showOpenFilePicker();
        const selectedFile = fileHandle[0];
        const fileObj = await selectedFile.getFile();
        const text = await fileObj.text();
        setFileContent(text);
    };

    const handleSaveFile = async () => {
        if (!currentFile) return;

        try {
            const fileHandle = await (window as any).showSaveFilePicker({
                suggestedName: currentFile,
            });
            const writable = await fileHandle.createWritable();
            await writable.write(fileContent);
            await writable.close();
            console.log('File saved successfully');
        } catch (err) {
            console.error("Saving file failed", err);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSaveFile();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fileContent, currentFile]);

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
                {fileList.length > 0 && (
                    <div className="file-list">
                        {fileList.map((file, index) => (
                            <div key={index} className="file-item" onClick={() => handleFileClick(file)}>
                                <i className={`file-icon ${getFileIcon(file)}`}/> {file}
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                        if (gutter) gutter.scrollTop = (e.target as HTMLElement).scrollTop;
                    }}
                />
            </div>
        </div>
    );
}
