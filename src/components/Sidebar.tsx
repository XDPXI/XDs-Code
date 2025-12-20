import React, { useMemo } from "react";
import { getFileIcon } from "../utils/fileHelpers";

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
}

const Sidebar: React.FC<SidebarProps> = ({
  fileList,
  dirStack,
  goBackDirectory,
  handleFileClick,
  handleOpenFolder,
  selectedDir,
}) => {
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

  return (
    <div className="sidebar">
      {selectedDir === "null" && (
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          Open Folder
        </button>
      )}
      <div className="file-list">{fileItems}</div>
    </div>
  );
};

export default Sidebar;
