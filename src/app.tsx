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
import SettingsPage from "./components/SettingsPage";
import { isImageFile, isVideoFile } from "./utils/fileHelpers";
import { useModal } from "./hooks/useModal";

interface AppSettings {
  editor_font_size: number;
  editor_word_wrap: boolean;
  editor_minimap: boolean;
  editor_line_numbers: boolean;
  editor_render_whitespace: boolean;
  terminal_font_size: number;
  sidebar_width: number;
  auto_save_enabled: boolean;
  auto_save_interval: number;
  theme: string;
}

export default function App() {
  const { alert, confirm } = useModal();
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
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const contentRef = useRef<string>("");
  const isDirtyRef = useRef<boolean>(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings(loaded);
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();
  }, []);

  // Autosave
  useEffect(() => {
    if (!settings || !settings.auto_save_enabled || !currentFile) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(async () => {
      if (isDirtyRef.current && currentFile && unsavedFiles.has(currentFile)) {
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

          setUnsavedFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(currentFile);
            return newSet;
          });

          isDirtyRef.current = false;
        } catch (error) {
          console.error("Autosave failed:", error);
        }
      }
    }, settings.auto_save_interval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [settings, currentFile, unsavedFiles]);

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
    async (filePath: string | null) => {
      if (!filePath) return;

      if (unsavedFiles.has(filePath)) {
        const result = await confirm(
          "This file has unsaved changes. Do you want to save them?",
          "Cancel",
          "Save",
        );

        if (!result) {
          return;
        }

        try {
          await invoke("write_file", {
            path: filePath,
            content: contentRef.current,
          });
          setUnsavedFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(filePath);
            return newSet;
          });
        } catch (error) {
          console.error("Failed to save file:", error);
          await alert(`Failed to save file: ${error}`);
          return;
        }
      }

      setOpenTabs((prev) => prev.filter((f) => f.path !== filePath));

      if (currentFile === filePath) {
        const remainingTabs = openTabs.filter((t) => t.path !== filePath);
        setCurrentFile(remainingTabs.length > 0 ? remainingTabs[0].path : null);
        setFileContent("");
        contentRef.current = "";
      }
    },
    [unsavedFiles, openTabs, currentFile, confirm, alert],
  );

  const readDirectory = useCallback(
    async (dirPath: string) => {
      try {
        const result = await invoke<DirectoryContents>("read_directory", {
          path: dirPath,
        });
        setFileList(result.entries);
        setCurrentDir(result.current_path);
      } catch (error) {
        console.error("Failed to read directory:", error);
        await alert(`Failed to read directory: ${error}`);
      }
    },
    [alert],
  );

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

      setUnsavedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentFile);
        return newSet;
      });

      isDirtyRef.current = false;
      console.log("File saved successfully");
    } catch (error) {
      console.error("Saving file failed", error);
      await alert(`Failed to save file: ${error}`);
    }
  }, [currentFile, alert]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a folder to open",
      });

      if (selected) {
        setDirStack([]);
        setSelectedDir(selected);
        await readDirectory(selected);
      }
    } catch (error) {
      console.error("Error opening folder:", error);
      await alert(`Failed to open folder: ${error}`);
    }
  }, [readDirectory, alert]);

  const handleFileClick = useCallback(
    async (entry: FileEntry) => {
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
            await alert("This file appears to be binary and cannot be opened.");
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
          await alert(`Failed to open file: ${error}`);
        }
      }
    },
    [currentDir, openTab, readDirectory, alert],
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
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        handleOpenFolder();
      }
    },
    [handleSaveFile, closeTab, currentFile],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTabClick = useCallback(
    (filePath: string) => {
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
    [openTabs],
  );

  const handleSettingsChange = async (
    newSettings: AppSettings,
  ): Promise<void> => {
    setSettings(newSettings);
  };

  // Apply sidebar width setting
  useEffect(() => {
    if (settings?.sidebar_width) {
      const sidebar = document.querySelector(".sidebar") as HTMLElement;
      if (sidebar) {
        sidebar.style.width = `${settings.sidebar_width}px`;
      }
    }
  }, [settings?.sidebar_width]);

  return (
    <div className="app-container">
      <TitleBar handleOpenFolder={handleOpenFolder} selectedDir={selectedDir} />
      <div className="content-container" data-tauri-drag-region>
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
              unsavedFiles={unsavedFiles}
            />
            <div className="editor-terminal-container">
              <div
                className={`editor ${terminalOpen ? "split" : ""}`}
                data-tauri-drag-region
                style={
                  settings
                    ? ({
                        "--editor-font-size": `${settings.editor_font_size}px`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {currentFile !== null &&
                  (mediaURL ? (
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
                      settings={settings}
                      onContentChange={() => {
                        isDirtyRef.current = true;
                        if (currentFile && !unsavedFiles.has(currentFile)) {
                          setUnsavedFiles((prev) => {
                            const newSet = new Set(prev);
                            newSet.add(currentFile);
                            return newSet;
                          });
                        }
                      }}
                    />
                  ))}
              </div>
              {terminalOpen && (
                <div
                  className="terminal-pane"
                  style={
                    settings
                      ? ({
                          "--terminal-font-size": `${settings.terminal_font_size}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
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

      <SettingsPage
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}
