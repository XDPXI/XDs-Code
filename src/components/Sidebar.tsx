import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { getFileIcon } from "../utils/fileHelpers";
import { invoke } from "@tauri-apps/api/core";
import { useModal } from "../hooks/useModal";

interface GitFileInfo {
  path: string;
  status: "untracked" | "modified" | "staged" | "unmodified";
}

interface SidebarProps {
  fileList: FileEntry[];
  dirStack: string[];
  goBackDirectory: () => void;
  handleFileClick: (entry: FileEntry) => void;
  handleOpenFolder: () => void;
  selectedDir: string;
  refreshDirectory: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  fileList,
  dirStack,
  goBackDirectory,
  handleFileClick,
  handleOpenFolder,
  selectedDir,
  refreshDirectory,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [gitStatus, setGitStatus] = useState<Map<string, GitFileInfo>>(
    new Map(),
  );
  const [isGitRepo, setIsGitRepo] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { alert, prompt } = useModal();

  useEffect(() => {
    if (selectedDir === "null") return;

    const checkGitAndLoadStatus = async () => {
      try {
        const isGit = await invoke<boolean>("is_git_repository", {
          path: selectedDir,
        });
        setIsGitRepo(isGit);

        if (isGit) {
          const status = await invoke<GitFileInfo[]>("get_git_status", {
            repoPath: selectedDir,
          });

          console.log("Git status response:", status);
          console.log("Selected dir:", selectedDir);
          console.log("File list:", fileList);

          const statusMap = new Map<string, GitFileInfo>();

          status.forEach((file) => {
            console.log(
              "Processing git file:",
              file.path,
              "Status:",
              file.status,
            );
            statusMap.set(file.path, file);
            const filename = file.path.split(/[/\\]/).pop();
            if (filename) {
              statusMap.set(filename, file);
            }
          });

          console.log("Final status map:", statusMap);
          setGitStatus(statusMap);
        } else {
          setGitStatus(new Map());
        }
      } catch (error) {
        console.error("Error checking git status:", error);
        setGitStatus(new Map());
      }
    };

    checkGitAndLoadStatus();

    const interval = setInterval(checkGitAndLoadStatus, 1000);
    return () => clearInterval(interval);
  }, [selectedDir]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, entry?: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();

    if (!entry) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "empty",
      });
    } else if (entry.is_directory) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "folder",
        entry,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "file",
        entry,
      });
    }
  };

  const handleCreateFile = useCallback(async () => {
    const fileName = await prompt("Enter file name:");
    if (!fileName) return;

    setContextMenu(null);
    try {
      const filePath = `${selectedDir}/${fileName}`;
      await invoke("create_file", { path: filePath });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to create file: ${error}`);
    }
  }, [selectedDir, prompt, alert, refreshDirectory]);

  const handleCreateFolder = useCallback(async () => {
    const folderName = await prompt("Enter folder name:");
    if (!folderName) return;

    setContextMenu(null);
    try {
      const folderPath = `${selectedDir}/${folderName}`;
      await invoke("create_directory", { path: folderPath });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to create folder: ${error}`);
    }
  }, [selectedDir, prompt, alert, refreshDirectory]);

  const handleOpenInFileManager = useCallback(async () => {
    if (!contextMenu?.entry && !selectedDir) {
      setContextMenu(null);
      return;
    }
    const pathToOpen = contextMenu?.entry?.path || selectedDir;
    setContextMenu(null);

    try {
      await invoke("open_in_file_manager", { path: pathToOpen });
    } catch (error) {
      alert(`Failed to open in file manager: ${error}`);
    }
  }, [contextMenu, selectedDir, alert]);

  const handleRunFile = useCallback(async () => {
    if (!contextMenu?.entry) {
      setContextMenu(null);
      return;
    }

    const filePath = contextMenu.entry.path;
    setContextMenu(null);

    try {
      await invoke("run_file", { path: filePath });
    } catch (error) {
      alert(`Failed to run file: ${error}`);
    }
  }, [contextMenu, alert]);

  const handleDeleteFile = useCallback(async () => {
    if (!contextMenu?.entry) {
      setContextMenu(null);
      return;
    }

    const entryToDelete = contextMenu.entry;
    setContextMenu(null);

    try {
      await invoke("delete_file", { path: entryToDelete.path });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to delete file: ${error}`);
    }
  }, [contextMenu, alert, refreshDirectory]);

  const handleDeleteFolder = useCallback(async () => {
    if (!contextMenu?.entry) {
      setContextMenu(null);
      return;
    }

    const entryToDelete = contextMenu.entry;
    setContextMenu(null);

    try {
      await invoke("delete_file", { path: entryToDelete.path });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to delete folder: ${error}`);
    }
  }, [contextMenu, alert, refreshDirectory]);

  const getGitStatusColor = (entry: FileEntry): string | undefined => {
    let gitInfo = gitStatus.get(entry.path);

    console.log("Checking entry:", entry.path, "Found:", gitInfo);

    if (!gitInfo && selectedDir !== "null") {
      const relativePath = entry.path
        .replace(selectedDir, "")
        .replace(/^[/\\]/, "");
      console.log("Trying relative path:", relativePath);
      gitInfo = gitStatus.get(relativePath);
    }

    if (!gitInfo) {
      const fileName = entry.path.split(/[/\\]/).pop();
      console.log("Trying filename:", fileName);
      if (fileName) {
        gitInfo = gitStatus.get(fileName);
      }
    }

    console.log("Final git info for", entry.path, ":", gitInfo);

    if (!gitInfo) return undefined;

    switch (gitInfo.status) {
      case "untracked":
        return "#a1c181";
      case "modified":
        return "#dec184";
      case "staged":
        return "#8FAECF";
      default:
        return undefined;
    }
  };

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
      const gitColor = getGitStatusColor(entry);
      const style = gitColor ? { color: gitColor } : {};

      items.push(
        <button
          key={entry.path}
          className="file-item"
          onClick={() => handleFileClick(entry)}
          onContextMenu={(e) => handleContextMenu(e, entry)}
          type="button"
          aria-label={
            entry.is_directory
              ? `Open folder ${entry.name}`
              : `Open file ${entry.name}`
          }
          style={style}
        >
          <i className={`file-icon ${icon}`} style={style} /> {entry.name}
        </button>,
      );
    }

    return items;
  }, [
    fileList,
    handleFileClick,
    goBackDirectory,
    dirStack,
    gitStatus,
    selectedDir,
  ]);

  return (
    <div
      className="sidebar"
      onContextMenu={(e) => selectedDir !== "null" && handleContextMenu(e)}
    >
      {selectedDir === "null" && (
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          Open Folder
        </button>
      )}
      <div data-tauri-drag-region className="file-list">
        {fileItems}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {contextMenu.type === "empty" && (
            <>
              <button
                className="context-menu-item"
                onClick={handleCreateFolder}
              >
                <i className="fa-solid fa-folder-plus" /> Create Folder
              </button>
              <button className="context-menu-item" onClick={handleCreateFile}>
                <i className="fa-solid fa-file" /> Create File
              </button>
              <button
                className="context-menu-item"
                onClick={handleOpenInFileManager}
              >
                <i className="fa-solid fa-folder-open" /> Open in File Manager
              </button>
            </>
          )}

          {contextMenu.type === "file" && (
            <>
              <button className="context-menu-item" onClick={handleRunFile}>
                <i className="fa-solid fa-play" /> Run File
              </button>
              <button
                className="context-menu-item"
                onClick={handleOpenInFileManager}
              >
                <i className="fa-solid fa-folder-open" /> Open in File Manager
              </button>
              <div className="context-menu-separator" />
              <button
                className="context-menu-item context-menu-item-danger"
                onClick={handleDeleteFile}
              >
                <i className="fa-solid fa-trash" /> Delete File
              </button>
            </>
          )}

          {contextMenu.type === "folder" && (
            <>
              <button
                className="context-menu-item"
                onClick={handleOpenInFileManager}
              >
                <i className="fa-solid fa-folder-open" /> Open in File Manager
              </button>
              <div className="context-menu-separator" />
              <button
                className="context-menu-item context-menu-item-danger"
                onClick={handleDeleteFolder}
              >
                <i className="fa-solid fa-trash" /> Delete Folder
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
