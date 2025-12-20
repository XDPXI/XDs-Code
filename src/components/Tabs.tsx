import React from "react";

interface TabsProps {
  openTabs: OpenFile[];
  currentFile: string | null;
  handleTabClick: (filePath: string) => void;
  closeTab: (filePath: string | null) => void;
}

const Tabs: React.FC<TabsProps> = ({
  openTabs,
  currentFile,
  handleTabClick,
  closeTab,
}) => {
  return (
    <div className="tabs">
      {openTabs.map((tab) => (
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
        </button>
      ))}
    </div>
  );
};

export default Tabs;
