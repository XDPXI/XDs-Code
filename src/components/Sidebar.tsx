import React, { useMemo, useState, useEffect, useRef } from "react";
import { getFileIcon } from "../utils/fileHelpers";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
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

interface ContextMenu {
  x: number;
  y: number;
  type: "file" | "folder" | "empty";
  entry?: FileEntry;
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
      // Right-click on empty space
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "empty",
      });
    } else if (entry.is_directory) {
      // Right-click on folder
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "folder",
        entry,
      });
    } else {
      // Right-click on file
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "file",
        entry,
      });
    }
  };

  const handleCreateFile = async () => {
    setContextMenu(null);
    const fileName = prompt("Enter file name:");
    if (!fileName) return;

    try {
      const filePath = `${selectedDir}/${fileName}`;
      await invoke("create_file", { path: filePath });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to create file: ${error}`);
    }
  };

  const handleCreateFolder = async () => {
    setContextMenu(null);
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    try {
      const folderPath = `${selectedDir}/${folderName}`;
      await invoke("create_directory", { path: folderPath });
      refreshDirectory();
    } catch (error) {
      alert(`Failed to create folder: ${error}`);
    }
  };

  const handleOpenInFileManager = async () => {
    setContextMenu(null);
    const pathToOpen = contextMenu?.entry?.path || selectedDir;

    try {
      await invoke("open_in_file_manager", { path: pathToOpen });
    } catch (error) {
      alert(`Failed to open in file manager: ${error}`);
    }
  };

  const handleRunFile = async () => {
    setContextMenu(null);
    if (!contextMenu?.entry) return;

    try {
      await invoke("run_file", { path: contextMenu.entry.path });
    } catch (error) {
      alert(`Failed to run file: ${error}`);
    }
  };

  const handleDeleteFile = async () => {
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
  };

  const handleDeleteFolder = async () => {
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
      <div className="file-list">{fileItems}</div>

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
