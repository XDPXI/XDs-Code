import { useCallback, useEffect, useRef, useState } from "react";
import "./styles/globals.css";
import "./styles/fontawesome.css";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import MediaPreview from "./components/MediaPreview";
import EditorWrapper from "./components/EditorWrapper";
import StatusBar from "./components/StatusBar";
import Terminal from "./components/Terminal";
import { isImageFile, isVideoFile } from "./utils/fileHelpers";

export default function App() {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenFile[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [currentDir, setCurrentDir] = useState<string>("");
  const [dirStack, setDirStack] = useState<string[]>([]);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [projectStructureOpen, setProjectStructureOpen] = useState(true);
  const [selectedDir, setSelectedDir] = useState<string>("null");
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
        "editor.lineHighlightBorder": "#FFFFFF00",
        "editor.lineHighlightBackground": "#2d323b",

        // Line Numbers
        "editorLineNumber.foreground": "#4e5a5f",
        "editorLineNumber.activeForeground": "#d0d4da",

        // Selection
        "editor.selectionBackground": "#3a4a5e",
        "editor.inactiveSelectionBackground": "#3a4a5e80",

        // Cursor
        "editorCursor.foreground": "#74ade8",

        // Other UI
        "editorIndentGuide.background": "#3f4247",
        "editorIndentGuide.activeBackground": "#4e5054",
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

  const refreshDirectory = useCallback(() => {
    if (currentDir) {
      readDirectory(currentDir);
    }
  }, [currentDir, readDirectory]);

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

      if (selected) {
        setDirStack([]);
        setSelectedDir(selected);
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

  const handleCtrlC = useCallback(() => {
    invoke("stop_terminal_command").catch((err) => {
      console.error("Stop command error:", err);
    });
  }, []);

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
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setProjectStructureOpen((prev) => !prev);
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

  return (
    <div className="app-container">
      <TitleBar handleOpenFolder={handleOpenFolder} selectedDir={selectedDir} />
      <div className="content-container">
        {projectStructureOpen && (
          <Sidebar
            fileList={fileList}
            dirStack={dirStack}
            goBackDirectory={goBackDirectory}
            handleFileClick={handleFileClick}
            handleOpenFolder={handleOpenFolder}
            selectedDir={selectedDir}
            refreshDirectory={refreshDirectory}
          />
        )}

        {selectedDir !== "null" && (
          <div className="editor-area">
            <Tabs
              openTabs={openTabs}
              currentFile={currentFile}
              handleTabClick={handleTabClick}
              closeTab={closeTab}
            />
            <div className="editor-terminal-container">
              <div className={`editor ${terminalOpen ? "split" : ""}`}>
                {currentFile !== null && (
                  mediaURL ? (
                    <MediaPreview
                      mediaURL={mediaURL}
                      currentFile={currentFile}
                    />
                  ) : (
                    <EditorWrapper
                      currentFile={currentFile}
                      fileContent={fileContent}
                      contentRef={contentRef}
                      setFileContent={setFileContent}
                      isDirtyRef={isDirtyRef}
                      defineCustomTheme={defineCustomTheme}
                    />
                  )
                )}
              </div>
              {terminalOpen && (
                <div className="terminal-pane">
                  <Terminal currentDir={currentDir} onCtrlC={handleCtrlC} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedDir !== "null" && (
        <StatusBar
          onTerminalToggle={() => setTerminalOpen((prev) => !prev)}
          onProjectStructureToggle={() =>
            setProjectStructureOpen((prev) => !prev)
          }
          terminalOpen={terminalOpen}
          projectStructureOpen={projectStructureOpen}
        />
      )}
    </div>
  );
}
