import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/globals.css";
import "../styles/fontawesome.css";
import Settings from "./Settings.tsx";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import Starter from "./Starter.tsx";
import Editor from "@monaco-editor/react";

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
    case "rs":
      return "rust";
    case "toml":
      return "toml";
    case "go":
      return "go";
    default:
      return "plaintext";
  }
};

const getFileIcon = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    // JavaScript/TypeScript
    case "js":
    case "mjs":
    case "cjs":
    case "ts":
      return "fa-brands fa-js";
    case "tsx":
    case "jsx":
      return "fa-brands fa-react";
    case "vue":
      return "fa-brands fa-vuejs";
    case "angular":
    case "ng":
      return "fa-brands fa-angular";

    // Web Technologies
    case "html":
    case "htm":
      return "fa-brands fa-html5";
    case "css":
    case "scss":
    case "sass":
    case "less":
      return "fa-brands fa-css3-alt";
    case "bootstrap":
      return "fa-brands fa-bootstrap";

    // Programming Languages
    case "java":
    case "class":
    case "jar":
      return "fa-brands fa-java";
    case "py":
    case "pyc":
    case "pyo":
    case "pyw":
      return "fa-brands fa-python";
    case "php":
    case "phtml":
      return "fa-brands fa-php";
    case "go":
    case "mod":
      return "fa-brands fa-golang";
    case "rs":
    case "toml":
      return "fa-brands fa-rust";
    case "swift":
      return "fa-brands fa-swift";
    case "rb":
    case "ruby":
    case "gem":
      return "fa-solid fa-gem";
    case "c":
    case "h":
      return "fa-solid fa-code";
    case "cpp":
    case "cxx":
    case "cc":
    case "hpp":
      return "fa-solid fa-code";
    case "cs":
      return "fa-solid fa-code";
    case "vb":
    case "vbs":
      return "fa-solid fa-code";
    case "pl":
    case "pm":
      return "fa-solid fa-code";
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return "fa-solid fa-terminal";
    case "bat":
    case "cmd":
      return "fa-solid fa-terminal";
    case "ps1":
    case "psm1":
      return "fa-solid fa-terminal";
    case "r":
    case "rmd":
      return "fa-brands fa-r-project";
    case "scala":
      return "fa-solid fa-code";
    case "kt":
    case "kts":
      return "fa-solid fa-code";
    case "dart":
      return "fa-solid fa-code";
    case "lua":
      return "fa-solid fa-code";
    case "erl":
    case "hrl":
      return "fa-brands fa-erlang";

    // Database
    case "sql":
    case "mysql":
    case "pgsql":
    case "sqlite":
    case "db":
      return "fa-solid fa-database";

    // Configuration Files
    case "json":
    case "jsonc":
    case "xml":
    case "xsl":
    case "xsd":
      return "fa-solid fa-code";
    case "yaml":
    case "yml":
      return "fa-solid fa-file-lines";
    case "ini":
    case "cfg":
    case "conf":
    case "config":
      return "fa-solid fa-gear";
    case "env":
    case "environment":
      return "fa-solid fa-gear";
    case "dockerignore":
    case "dockerfile":
      return "fa-brands fa-docker";

    // Version Control
    case "gitignore":
    case "gitattributes":
    case "git":
      return "fa-brands fa-git-alt";

    // Documentation
    case "md":
    case "markdown":
    case "mdx":
      return "fa-brands fa-markdown";
    case "txt":
    case "text":
      return "fa-solid fa-file-lines";
    case "rtf":
      return "fa-solid fa-file-lines";
    case "readme":
      return "fa-solid fa-circle-info";
    case "license":
    case "licence":
      return "fa-solid fa-scale-balanced";
    case "changelog":
    case "changes":
      return "fa-solid fa-list";

    // Office Documents
    case "doc":
    case "docx":
      return "fa-brands fa-microsoft";
    case "xls":
    case "xlsx":
    case "csv":
      return "fa-solid fa-file-excel";
    case "ppt":
    case "pptx":
      return "fa-solid fa-file-powerpoint";
    case "pdf":
      return "fa-solid fa-file-pdf";
    case "odt":
    case "ods":
    case "odp":
      return "fa-solid fa-file-lines";

    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "bmp":
    case "tiff":
    case "tif":
    case "webp":
    case "avif":
    case "heic":
    case "heif":
      return "fa-regular fa-image";
    case "svg":
      return "fa-solid fa-vector-square";
    case "ico":
    case "icns":
      return "fa-solid fa-icons";
    case "psd":
    case "ai":
    case "eps":
      return "fa-solid fa-paintbrush";
    case "fig":
    case "figma":
      return "fa-brands fa-figma";
    case "sketch":
      return "fa-brands fa-sketch";

    // Audio
    case "mp3":
    case "wav":
    case "flac":
    case "aac":
    case "ogg":
    case "wma":
    case "m4a":
    case "opus":
      return "fa-solid fa-music";

    // Video
    case "mp4":
    case "avi":
    case "mkv":
    case "mov":
    case "wmv":
    case "flv":
    case "webm":
    case "m4v":
    case "3gp":
    case "ogv":
      return "fa-solid fa-film";

    // Archives
    case "zip":
    case "7z":
    case "rar":
    case "tar":
    case "gz":
    case "bz2":
    case "xz":
    case "z":
    case "lz":
    case "lzma":
    case "cab":
    case "deb":
    case "rpm":
    case "dmg":
    case "pkg":
    case "msi":
    case "exe":
    case "app":
      return "fa-solid fa-file-zipper";

    // Fonts
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
    case "eot":
      return "fa-solid fa-font";

    // 3D/CAD
    case "obj":
    case "fbx":
    case "dae":
    case "gltf":
    case "glb":
    case "3ds":
    case "blend":
    case "max":
    case "maya":
    case "dwg":
    case "dxf":
      return "fa-solid fa-cube";

    // Package Managers
    case "npm":
    case "yarn":
      return "fa-brands fa-npm";
    case "composer":
      return "fa-solid fa-box";
    case "pip":
    case "pipfile":
      return "fa-brands fa-python";
    case "cargo":
      return "fa-brands fa-rust";
    case "gemfile":
      return "fa-solid fa-gem";
    case "podfile":
      return "fa-solid fa-box";

    // Build/Task Files
    case "makefile":
    case "make":
      return "fa-solid fa-hammer";
    case "cmake":
      return "fa-solid fa-hammer";
    case "gradle":
      return "fa-solid fa-hammer";
    case "gulpfile":
    case "gruntfile":
      return "fa-solid fa-hammer";
    case "webpack":
      return "fa-solid fa-cube";
    case "rollup":
    case "vite":
      return "fa-solid fa-cube";

    // Certificates/Keys
    case "pem":
    case "crt":
    case "cert":
    case "cer":
    case "p12":
    case "pfx":
    case "key":
    case "pub":
      return "fa-solid fa-key";

    // Log Files
    case "log":
    case "logs":
      return "fa-solid fa-file-lines";

    // Temporary/Cache
    case "tmp":
    case "temp":
    case "cache":
    case "bak":
    case "backup":
    case "old":
      return "fa-solid fa-clock-rotate-left";

    // Default
    default:
      return "fa-regular fa-file";
  }
};

const isImageFile = (filename: string) => {
  return /\.(png|ico|jpe?g|gif|webp|svg)$/i.test(filename);
};

const isVideoFile = (filename: string) => {
  return /\.(mp4|webm|ogg|mov)$/i.test(filename);
};

export default function App() {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenFile[]>([]);
  const [hasOpened, setHasOpened] = useState<boolean>(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [currentDir, setCurrentDir] = useState<string>("");
  const [dirStack, setDirStack] = useState<string[]>([]);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [version, setVersion] = useState("0.0.0");
  const contentRef = useRef<string>("");
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

    void fetchVersion();
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

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
      setHasOpened(true);
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

  if (showSettings) {
    return <Settings setShowSettings={setShowSettings} version={version} />;
  } else if (!hasOpened) {
    return (
      <Starter
        handleOpenFolder={handleOpenFolder}
        handleOpenSettings={handleOpenSettings}
      />
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          📁 Open Folder
        </button>
        <button className="open-folder-btn" onClick={handleOpenSettings}>
          ⚙️ Settings
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
