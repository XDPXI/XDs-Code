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
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { alert, prompt } = useModal();

  useEffect(() => {
    if (selectedDir === "null") return;

    const interval = setInterval(() => {
      refreshDirectory();
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedDir, refreshDirectory]);

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

  // FIX: Memoize file items with stable dependencies
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
          onContextMenu={(e) => handleContextMenu(e, entry)}
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
