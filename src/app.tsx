import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles/globals.css";
import "./styles/fontawesome.css";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import Editor from "@monaco-editor/react";
import {
  getMonacoLanguage,
  getFileIcon,
  isImageFile,
  isVideoFile,
} from "./utils/fileHelpers";

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

interface DirectoryContents {
  entries: FileEntry[];
  current_path: string;
}

interface OpenFile {
  name: string;
  path: string;
  content: string;
}

export default function App() {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenFile[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [currentDir, setCurrentDir] = useState<string>("");
  const [dirStack, setDirStack] = useState<string[]>([]);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const contentRef = useRef<string>("");
  const isDirtyRef = useRef<boolean>(false);

  const defineCustomTheme = (monaco: typeof import("monaco-editor")) => {
    monaco.editor.defineTheme("xd-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        // Background
        "editor.background": "#282c33",
        "editorGutter.background": "#282c33",

        // Line Highlight
        "editor.lineHighlightBorder": "#464b57",
        "editor.lineHighlightBackground": "#464b5715",

        // Selection
        "editor.selectionBackground": "#3a4a5e",
        "editor.inactiveSelectionBackground": "#3a4a5e80",
      },
    });
  };

  const openTab = useCallback((file: OpenFile) => {
    setOpenTabs((prev) => {
      const exists = prev.find((f) => f.path === file.path);
      if (exists) return prev;
      return [...prev, file];
    });
    setCurrentFile(file.path);
  }, []);

  const closeTab = useCallback(
    (filePath: string | null) => {
      setOpenTabs((prev) => prev.filter((f) => f.path !== filePath));
      if (currentFile === filePath) {
        setOpenTabs((prev) => {
          if (prev.length > 1) {
            const newCurrent = prev.find((f) => f.path !== filePath);
            if (newCurrent) {
              setCurrentFile(newCurrent.path);
              setFileContent(newCurrent.content);
              contentRef.current = newCurrent.content;
            }
          } else {
            setCurrentFile(null);
            setFileContent("");
            contentRef.current = "";
          }
          return prev;
        });
      }
    },
    [currentFile],
  );

  const readDirectory = useCallback(async (dirPath: string) => {
    try {
      const result = await invoke<DirectoryContents>("read_directory", {
        path: dirPath,
      });
      setFileList(result.entries);
      setCurrentDir(result.current_path);
    } catch (error) {
      console.error("Failed to read directory:", error);
      alert(`Failed to read directory: ${error}`);
    }
  }, []);

  const handleSaveFile = useCallback(async () => {
    if (!currentFile) {
      console.error("No file to save");
      return;
    }

    try {
      await invoke("write_file", {
        path: currentFile,
        content: contentRef.current,
      });

      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.path === currentFile
            ? { ...tab, content: contentRef.current }
            : tab,
        ),
      );

      isDirtyRef.current = false;
      console.log("File saved successfully");
    } catch (error) {
      console.error("Saving file failed", error);
      alert(`Failed to save file: ${error}`);
    }
  }, [currentFile]);

  const handleOpenFolder = useCallback(async () => {
    try {
      console.log("Opening folder dialog...");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a folder to open",
      });

      console.log("Selected:", selected);

      if (selected && typeof selected === "string") {
        setDirStack([]);
        await readDirectory(selected);
      } else if (selected) {
        console.error("Unexpected selected value:", selected);
      } else {
        console.log("No folder selected");
      }
    } catch (error) {
      console.error("Error opening folder:", error);
      alert(`Failed to open folder: ${error}`);
    }
  }, [readDirectory]);

  const handleFileClick = useCallback(
    async (entry: FileEntry) => {
      if (isDirtyRef.current && currentFile) {
        const confirmSave = window.confirm(
          "You have unsaved changes. Do you want to save them?",
        );
        if (confirmSave) {
          await handleSaveFile();
        }
        isDirtyRef.current = false;
      }

      if (entry.is_directory) {
        setDirStack((prev) => [...prev, currentDir]);
        await readDirectory(entry.path);
      } else {
        try {
          const isBinary = await invoke<boolean>("is_binary_file", {
            path: entry.path,
          });

          if (
            isBinary &&
            !isImageFile(entry.name) &&
            !isVideoFile(entry.name)
          ) {
            alert("This file appears to be binary and cannot be opened.");
            return;
          }

          if (isImageFile(entry.name) || isVideoFile(entry.name)) {
            const url = `asset://localhost/${entry.path}`;
            setMediaURL(url);
            setFileContent("");
            contentRef.current = "";
            setCurrentFile(entry.path);

            openTab({
              name: entry.name,
              path: entry.path,
              content: "",
            });
          } else {
            const content = await invoke<string>("read_file", {
              path: entry.path,
            });

            contentRef.current = content;
            setFileContent(content);
            setMediaURL(null);
            setCurrentFile(entry.path);

            openTab({
              name: entry.name,
              path: entry.path,
              content: content,
            });
          }
        } catch (error) {
          console.error("Failed to open file:", error);
          alert(`Failed to open file: ${error}`);
        }
      }
    },
    [currentFile, currentDir, handleSaveFile, openTab, readDirectory],
  );

  const goBackDirectory = useCallback(() => {
    const newStack = [...dirStack];
    const parent = newStack.pop();
    if (parent) {
      setDirStack(newStack);
      readDirectory(parent);
    }
  }, [dirStack, readDirectory]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        closeTab(currentFile);
      }
    },
    [handleSaveFile, closeTab, currentFile],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTabClick = useCallback(
    async (filePath: string) => {
      if (isDirtyRef.current && currentFile && currentFile !== filePath) {
        const confirmSave = window.confirm(
          "You have unsaved changes. Do you want to save them?",
        );
        if (confirmSave) {
          await handleSaveFile();
        }
        isDirtyRef.current = false;
      }

      const tab = openTabs.find((t) => t.path === filePath);
      if (tab) {
        setCurrentFile(tab.path);

        if (isImageFile(tab.name) || isVideoFile(tab.name)) {
          const url = `asset://localhost/${tab.path}`;
          setMediaURL(url);
          setFileContent("");
          contentRef.current = "";
        } else {
          contentRef.current = tab.content;
          setFileContent(tab.content);
          setMediaURL(null);
        }
      }
    },
    [currentFile, openTabs, handleSaveFile],
  );

  const fileItems = useMemo(() => {
    const items = [];

    if (dirStack.length > 0) {
      items.push(
        <button
          key="up"
          className="file-item"
          onClick={goBackDirectory}
          type="button"
          aria-label="Go to parent directory"
        >
          <i className="fa-solid fa-arrow-up" /> ..
        </button>,
      );
    }

    for (const entry of fileList) {
      const icon = entry.is_directory
        ? "fa-solid fa-folder"
        : getFileIcon(entry.name);
      items.push(
        <button
          key={entry.path}
          className="file-item"
          onClick={() => handleFileClick(entry)}
          type="button"
          aria-label={
            entry.is_directory
              ? `Open folder ${entry.name}`
              : `Open file ${entry.name}`
          }
        >
          <i className={`file-icon ${icon}`} /> {entry.name}
        </button>,
      );
    }

    return items;
  }, [fileList, handleFileClick, goBackDirectory, dirStack]);

  const tabItems = useMemo(
    () =>
      openTabs.map((tab) => (
        <button
          key={tab.path}
          className={`tab-item ${currentFile === tab.path ? "active" : ""}`}
          onClick={() => handleTabClick(tab.path)}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              closeTab(tab.path);
            }
          }}
          type="button"
          role="tab"
          aria-selected={currentFile === tab.path}
        >
          {tab.name}
          <button
            className="close-tab-btn"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.path);
            }}
            aria-label={`Close ${tab.name} tab`}
            tabIndex={0}
            type="button"
          >
            X
          </button>
        </button>
      )),
    [openTabs, currentFile, closeTab, handleTabClick],
  );

  return (
    <div className="editor-container">
      <div className="sidebar">
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          Open Folder
        </button>
        <div className="file-list">{fileItems}</div>
      </div>

      <div className="main-editor">
        <div className="tabs">{tabItems}</div>
        <div className="editor">
          {mediaURL && isImageFile(currentFile ?? "") && (
            <div className="media-preview">
              <img
                src={mediaURL}
                alt={currentFile ?? ""}
                style={{ maxWidth: "100%", maxHeight: "100%" }}
              />
            </div>
          )}

          {mediaURL && isVideoFile(currentFile ?? "") && (
            <div className="media-preview">
              <video controls style={{ maxWidth: "100%", maxHeight: "100%" }}>
                <source src={mediaURL} />
                <track
                  kind="captions"
                  src=""
                  label="English"
                  srcLang="en"
                  default
                />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {!mediaURL && (
            <Editor
              height="100%"
              language={getMonacoLanguage(
                currentFile
                  ? currentFile.split("/").pop() ||
                      currentFile.split("\\").pop() ||
                      ""
                  : "",
              )}
              value={fileContent}
              onChange={(value) => {
                contentRef.current = value || "";
                setFileContent(value || "");
                isDirtyRef.current = true;
              }}
              beforeMount={defineCustomTheme}
              theme="xd-dark"
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
