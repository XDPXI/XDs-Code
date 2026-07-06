import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { useModal } from "../hooks/useModal";
import TreeNode from "./TreeNode";

interface GitFileInfo {
  path: string;
  status: "untracked" | "modified" | "staged" | "unmodified";
}

interface SidebarLegacyProps {
  fileList: FileEntry[];
  dirStack: string[];
  goBackDirectory: () => void;
  handleFileClick: (entry: FileEntry) => void;
  selectedDir: string;
  refreshDirectory: () => void;
  onFolderNavigate?: (folderPath: string) => void;
  theme?: string;
}

const SidebarLegacy: React.FC<SidebarLegacyProps> = ({
  fileList,
  dirStack,
  goBackDirectory,
  handleFileClick,
  selectedDir,
  refreshDirectory,
  onFolderNavigate,
  theme,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [gitStatus, setGitStatus] = useState<Map<string, GitFileInfo>>(
    new Map(),
  );
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { alert, prompt, confirm } = useModal();

  useEffect(() => {
    if (selectedDir === "null") return;

    const checkGitAndLoadStatus = async () => {
      try {
        const isGit = await invoke<boolean>("is_git_repository", {
          path: selectedDir,
        });

        if (isGit) {
          const status = await invoke<GitFileInfo[]>("get_git_status", {
            repoPath: selectedDir,
          });

          const statusMap = new Map<string, GitFileInfo>();

          status.forEach((file) => {
            statusMap.set(file.path, file);
            const filename = file.path.split(/[/\\]/).pop();
            if (filename) {
              statusMap.set(filename, file);
            }
          });

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry?: FileEntry) => {
      e.preventDefault();
      e.stopPropagation();
      const type = !entry ? "empty" : entry.is_directory ? "folder" : "file";
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type,
        entry,
      });
    },
    [],
  );

  const handleCreateFile = useCallback(
    async (targetDir?: string) => {
      const fileName = await prompt("Enter file name:");
      if (!fileName) return;

      setContextMenu(null);
      const dir = targetDir || selectedDir;

      try {
        const filePath = `${dir}/${fileName}`;
        await invoke("create_file", { path: filePath });
        refreshDirectory();
      } catch (error) {
        alert(`Failed to create file: ${error}`);
      }
    },
    [selectedDir, prompt, alert, refreshDirectory],
  );

  const handleCreateFolder = useCallback(
    async (targetDir?: string) => {
      const folderName = await prompt("Enter folder name:");
      if (!folderName) return;

      setContextMenu(null);
      const dir = targetDir || selectedDir;

      try {
        const folderPath = `${dir}/${folderName}`;
        await invoke("create_directory", { path: folderPath });
        refreshDirectory();
      } catch (error) {
        alert(`Failed to create folder: ${error}`);
      }
    },
    [selectedDir, prompt, alert, refreshDirectory],
  );

  const handleOpenInFileManager = useCallback(async () => {
    if (!contextMenu?.entry && !selectedDir) {
      return;
    }

    const path = contextMenu?.entry?.path || selectedDir;

    try {
      await invoke("open_in_file_manager", { path });
    } catch (error) {
      alert(`Failed to open in file manager: ${error}`);
    }
  }, [contextMenu, alert]);

  const handleDeleteFile = useCallback(async () => {
    if (!contextMenu?.entry) {
      return;
    }

    const file = contextMenu.entry;
    const message = file.is_directory
      ? `Delete folder '${file.name}'? This action cannot be undone.`
      : `Delete file '${file.name}'? This action cannot be undone.`;

    const result = await confirm(message, "Cancel", "Delete");

    if (result) {
      setContextMenu(null);
      try {
        await invoke("delete_file", { path: file.path });
        refreshDirectory();
      } catch (error) {
        alert(`Failed to delete: ${error}`);
      }
    }
  }, [contextMenu, alert, refreshDirectory, confirm]);

  const handleRunFile = useCallback(async () => {
    if (!contextMenu?.entry) {
      return;
    }

    const file = contextMenu.entry;

    setContextMenu(null);

    try {
      await invoke("run_file", { path: file.path });
    } catch (error) {
      alert(`Failed to run file: ${error}`);
    }
  }, [contextMenu, alert]);

  const getGitStatusColor = (entry: FileEntry): string | undefined => {
    let gitInfo = gitStatus.get(entry.path);

    if (!gitInfo && selectedDir !== "null") {
      const relativePath = entry.path
        .replace(selectedDir, "")
        .replace(/^[/\\]/, "");
      gitInfo = gitStatus.get(relativePath);
    }

    if (!gitInfo) {
      const fileName = entry.path.split(/[/\\]/).pop();
      if (fileName) {
        gitInfo = gitStatus.get(fileName);
      }
    }

    if (!gitInfo) return undefined;

    const isXP = theme === "windows-xp";
    switch (gitInfo.status) {
      case "untracked":
        return isXP ? "#3d6b22" : "#a1c181";
      case "modified":
        return isXP ? "#8c6520" : "#dec184";
      case "staged":
        return isXP ? "#2a5480" : "#8FAECF";
      default:
        return undefined;
    }
  };

  const renderItems = useMemo(() => {
    const items = [];

    if (dirStack.length > 0) {
      items.push(
        <div
          key="back-button"
          className="tree-node"
          style={{ paddingLeft: "0px" }}
          onClick={goBackDirectory}
        >
          <button
            className="tree-icon-btn"
            onClick={goBackDirectory}
            type="button"
            aria-label="Go to parent directory"
          >
            <i className="fa-solid fa-arrow-up" />
          </button>
          <button className="tree-name-btn" onClick={goBackDirectory}>
            ..
          </button>
        </div>,
      );
    }

    for (const entry of fileList) {
      const gitColor = getGitStatusColor(entry);

      items.push(
        <TreeNode
          key={entry.path}
          entry={entry}
          absolutePath={entry.path}
          isExpanded={false}
          depth={0}
          onToggleExpand={async (path) => {
            if (entry.is_directory) {
              onFolderNavigate?.(path);
            }
          }}
          onFileClick={handleFileClick}
          onContextMenu={handleContextMenu}
          gitStatusColor={gitColor}
        />,
      );
    }

    return items;
  }, [
    fileList,
    dirStack,
    goBackDirectory,
    gitStatus,
    onFolderNavigate,
    handleFileClick,
    handleContextMenu,
    getGitStatusColor,
  ]);

  return (
    <div className="sidebar">
      <div data-tauri-drag-region className="file-list">
        {renderItems}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          {contextMenu.type === "empty" && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCreateFolder();
                }}
              >
                <i className="fa-solid fa-folder-plus" /> Create Folder
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCreateFile();
                }}
              >
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
              <button
                className="context-menu-item"
                onClick={() => {
                  const parentDir = contextMenu.entry?.path.substring(
                    0,
                    Math.max(
                      contextMenu.entry.path.lastIndexOf("/"),
                      contextMenu.entry.path.lastIndexOf("\\"),
                    ),
                  );
                  handleCreateFile(parentDir);
                }}
              >
                <i className="fa-solid fa-file" /> Create File
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  const parentDir = contextMenu.entry?.path.substring(
                    0,
                    Math.max(
                      contextMenu.entry.path.lastIndexOf("/"),
                      contextMenu.entry.path.lastIndexOf("\\"),
                    ),
                  );
                  handleCreateFolder(parentDir);
                }}
              >
                <i className="fa-solid fa-folder-plus" /> Create Folder
              </button>
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
                onClick={() => {
                  handleCreateFile(contextMenu.entry?.path);
                }}
              >
                <i className="fa-solid fa-file" /> Create File
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCreateFolder(contextMenu.entry?.path);
                }}
              >
                <i className="fa-solid fa-folder-plus" /> Create Folder
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
                <i className="fa-solid fa-trash" /> Delete Folder
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SidebarLegacy;
