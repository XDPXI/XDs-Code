import React, { useCallback, useMemo, useState } from "react";
import { getFileIcon } from "../utils/fileHelpers";

// Constants for UI configuration
const INDENT_PER_LEVEL = 16; // pixels
const FOLDER_CLOSED_ICON = "fa-folder";
const FOLDER_OPEN_ICON = "fa-folder-open";

interface TreeNodeProps {
  entry: FileEntry;
  absolutePath: string;
  isExpanded: boolean;
  depth: number;
  onToggleExpand: (path: string) => Promise<void>;
  onFileClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  gitStatusColor?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  entry,
  absolutePath,
  isExpanded,
  depth,
  onToggleExpand,
  onFileClick,
  onContextMenu,
  gitStatusColor,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const style = useMemo(
    () => (gitStatusColor ? { color: gitStatusColor } : {}),
    [gitStatusColor],
  );

  const indentStyle = useMemo(
    () => ({ paddingLeft: `${depth * INDENT_PER_LEVEL}px` }),
    [depth],
  );

  const handleIconClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsLoading(true);
      try {
        await onToggleExpand(absolutePath);
      } catch (error) {
        console.error("Failed to toggle expand:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [absolutePath, onToggleExpand],
  );

  const handleNameClick = useCallback(() => {
    onFileClick(entry);
  }, [entry, onFileClick]);

  return (
    <>
      <div
        className="tree-node"
        style={indentStyle}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {entry.is_directory ? (
          <>
            <button
              className="tree-icon-btn"
              onClick={handleIconClick}
              type="button"
              disabled={isLoading}
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            >
              <i
                className={`fa-solid ${isExpanded ? FOLDER_OPEN_ICON : FOLDER_CLOSED_ICON}`}
                style={style}
              />
            </button>
            <button
              className="tree-name-btn"
              onClick={(e) => {
                handleIconClick(e);
              }}
              type="button"
              style={style}
            >
              {entry.name}
            </button>
          </>
        ) : (
          <>
            <button
              className="tree-name-btn"
              onClick={handleNameClick}
              type="button"
              style={style}
              aria-label={`Open file ${entry.name}`}
            >
              <i
                className={`tree-file-icon ${getFileIcon(entry.name)}`}
                style={style}
              />
              {entry.name}
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default React.memo(TreeNode);
