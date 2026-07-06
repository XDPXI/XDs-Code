import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { useModal } from "../hooks/useModal";
import TreeNode from "./TreeNode";
import SidebarLegacy from "./SidebarLegacy";

interface GitFileInfo {
  path: string;
  status: "untracked" | "modified" | "staged" | "unmodified";
}

interface SidebarProps {
  rootContents: FileEntry[];
  handleFileClick: (entry: FileEntry) => void;
  handleOpenFolder: () => void;
  selectedDir: string;
  refreshDirectory: () => void;
  sidebarDesign?: "legacy" | "modern";
  onFolderNavigate?: (folderPath: string) => void;
  theme?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  rootContents,
  handleFileClick,
  handleOpenFolder,
  selectedDir,
  refreshDirectory,
  sidebarDesign = "modern",
  onFolderNavigate,
  theme,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [gitStatus, setGitStatus] = useState<Map<string, GitFileInfo>>(
    new Map(),
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [folderCache, setFolderCache] = useState<Map<string, FileEntry[]>>(
    new Map(),
  );
  const [dirStack, setDirStack] = useState<string[]>([]);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { alert, prompt, confirm } = useModal();

  const handleLegacyFolderNavigate = useCallback(
    (folderPath: string) => {
      if (sidebarDesign === "legacy") {
        setDirStack((prev) => [...prev, selectedDir]);
      }
      onFolderNavigate?.(folderPath);
    },
    [sidebarDesign, selectedDir, onFolderNavigate],
  );

  const goBackDirectory = useCallback(() => {
    const newStack = [...dirStack];
    const parent = newStack.pop();
    if (parent) {
      setDirStack(newStack);
      onFolderNavigate?.(parent);
    }
  }, [dirStack, onFolderNavigate]);

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

          console.log("Git status response:", status);
          console.log("Selected dir:", selectedDir);
          console.log("Root contents:", rootContents);

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

  const handleCreateFile = useCallback(
    async (targetDir?: string) => {
      const fileName = await prompt("Enter file name:");
      if (!fileName) return;

      setContextMenu(null);
      const dir = targetDir || selectedDir;

      try {
        const filePath = `${dir}/${fileName}`;
        await invoke("create_file", { path: filePath });

        // Invalidate cache for parent directory
        setFolderCache((prev) => {
          const newMap = new Map(prev);
          newMap.delete(dir);
          return newMap;
        });

        // Ensure parent folder is expanded if it's nested
        if (dir !== selectedDir) {
          setExpandedFolders((prev) => new Set(prev).add(dir));
        }

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

        // Invalidate cache for parent directory
        setFolderCache((prev) => {
          const newMap = new Map(prev);
          newMap.delete(dir);
          return newMap;
        });

        // Ensure parent folder is expanded if it's nested
        if (dir !== selectedDir) {
          setExpandedFolders((prev) => new Set(prev).add(dir));
        }

        refreshDirectory();
      } catch (error) {
        alert(`Failed to create folder: ${error}`);
      }
    },
    [selectedDir, prompt, alert, refreshDirectory],
  );

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

    const result = await confirm(
      `Delete file '${entryToDelete.name}'? This action cannot be undone.`,
      "Cancel",
      "Delete",
    );

    if (!result) {
      return;
    }

    try {
      await invoke("delete_file", { path: entryToDelete.path });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to delete file: ${error}`);
    }
  }, [contextMenu, alert, refreshDirectory, confirm]);

  const handleDeleteFolder = useCallback(async () => {
    if (!contextMenu?.entry) {
      setContextMenu(null);
      return;
    }

    const entryToDelete = contextMenu.entry;
    setContextMenu(null);

    const result = await confirm(
      `Delete folder '${entryToDelete.name}'? This action cannot be undone.`,
      "Cancel",
      "Delete",
    );

    if (!result) {
      return;
    }

    try {
      await invoke("delete_file", { path: entryToDelete.path });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to delete folder: ${error}`);
    }
  }, [contextMenu, alert, refreshDirectory, confirm]);

  const handleToggleFolder = useCallback(
    async (path: string) => {
      // If already in cache, just toggle expanded state
      if (folderCache.has(path)) {
        setExpandedFolders((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(path)) {
            newSet.delete(path);
          } else {
            newSet.add(path);
          }
          return newSet;
        });
        return;
      }

      // Load folder contents and add to cache
      try {
        const result = await invoke<DirectoryContents>("read_directory", {
          path,
        });
        setFolderCache((prev) => {
          const newMap = new Map(prev);
          newMap.set(path, result.entries);
          return newMap;
        });

        // Toggle expanded state
        setExpandedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.add(path);
          return newSet;
        });
      } catch (error) {
        console.error(`Failed to load folder ${path}:`, error);
        alert(`Failed to load folder: ${error}`);
      }
    },
    [folderCache, alert],
  );

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

  const renderTreeChildren = (
    entry: FileEntry,
    depth: number,
    expanded: Set<string>,
    cache: Map<string, FileEntry[]>,
  ): React.ReactNode => {
    const gitColor = getGitStatusColor(entry);
    const children = cache.get(entry.path) || [];
    const isExpanded = expanded.has(entry.path);

    return (
      <React.Fragment key={entry.path}>
        <TreeNode
          entry={entry}
          absolutePath={entry.path}
          isExpanded={isExpanded}
          depth={depth}
          onToggleExpand={handleToggleFolder}
          onFileClick={handleFileClick}
          onContextMenu={handleContextMenu}
          gitStatusColor={gitColor}
        />
        {isExpanded &&
          entry.is_directory &&
          children.map((child) =>
            renderTreeChildren(child, depth + 1, expanded, cache),
          )}
      </React.Fragment>
    );
  };

  const renderTree = useCallback(() => {
    const items = [];

    for (const entry of rootContents) {
      const gitColor = getGitStatusColor(entry);
      const children = folderCache.get(entry.path) || [];
      const isExpanded = expandedFolders.has(entry.path);

      items.push(
        <React.Fragment key={entry.path}>
          <TreeNode
            entry={entry}
            absolutePath={entry.path}
            isExpanded={isExpanded}
            depth={0}
            onToggleExpand={handleToggleFolder}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            gitStatusColor={gitColor}
          />
          {isExpanded &&
            entry.is_directory &&
            children.map((child) =>
              renderTreeChildren(child, 1, expandedFolders, folderCache),
            )}
        </React.Fragment>,
      );
    }

    return items;
  }, [
    rootContents,
    expandedFolders,
    folderCache,
    handleToggleFolder,
    handleFileClick,
    handleContextMenu,
    getGitStatusColor,
  ]);

  if (sidebarDesign === "legacy") {
    return (
      <SidebarLegacy
        fileList={rootContents}
        dirStack={dirStack}
        goBackDirectory={goBackDirectory}
        handleFileClick={handleFileClick}
        selectedDir={selectedDir}
        refreshDirectory={refreshDirectory}
        onFolderNavigate={handleLegacyFolderNavigate}
        theme={theme}
      />
    );
  }

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
        {renderTree()}
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
