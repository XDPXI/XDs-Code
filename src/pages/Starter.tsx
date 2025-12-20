interface StarterProps {
  handleOpenFolder: () => Promise<void>;
  handleOpenSettings: () => void;
}

export default function Starter({
  handleOpenFolder,
  handleOpenSettings,
}: Readonly<StarterProps>) {
  return (
    <div className="starter-screen">
      <h1 className="starter-title">XD's Code</h1>
      <button className="starter-btn" onClick={handleOpenFolder}>
        📁 Open Folder
      </button>
      <button className="starter-btn" onClick={handleOpenSettings}>
        ⚙️ Settings
      </button>
    </div>
  );
}
