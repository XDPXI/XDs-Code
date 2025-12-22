import React from "react";

interface TabsProps {
  openTabs: OpenFile[];
  currentFile: string | null;
  handleTabClick: (filePath: string) => void;
  closeTab: (filePath: string | null) => void;
  unsavedFiles: Set<string>;
}

const Tabs: React.FC<TabsProps> = ({
  openTabs,
  currentFile,
  handleTabClick,
  closeTab,
  unsavedFiles,
}) => {
  return (
    <div className="tabs" data-tauri-drag-region>
      {openTabs.map((tab) => {
        const hasUnsavedChanges = unsavedFiles.has(tab.path);
        return (
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
            title={tab.path}
          >
            <span className="tab-name">
              {tab.name}
              {hasUnsavedChanges && (
                <span className="tab-unsaved-indicator">*</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
