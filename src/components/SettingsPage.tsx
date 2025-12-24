import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useModal } from "../hooks/useModal";

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: AppSettings) => void;
}

interface AppSettings {
  editor_font_size: number;
  editor_word_wrap: boolean;
  editor_minimap: boolean;
  editor_line_numbers: boolean;
  editor_render_whitespace: boolean;
  terminal_font_size: number;
  sidebar_width: number;
  auto_save_enabled: boolean;
  auto_save_interval: number;
  theme: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  editor_font_size: 14,
  editor_word_wrap: true,
  editor_minimap: false,
  editor_line_numbers: true,
  editor_render_whitespace: false,
  terminal_font_size: 13,
  sidebar_width: 240,
  auto_save_enabled: false,
  auto_save_interval: 5000,
  theme: "dark",
};

const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useModal();

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await invoke<AppSettings>("load_settings");
      setSettings(loaded);
    } catch (err) {
      setError(`Failed to load settings: ${err}`);
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings: AppSettings): Promise<void> => {
    try {
      await invoke("save_settings", { settings: updatedSettings });
      setSettings(updatedSettings);
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    } catch (err) {
      setError(`Failed to save settings: ${err}`);
      console.error("Error saving settings:", err);
    }
  };

  const handleSettingChange = async (
    key: keyof AppSettings,
    value: string | number | boolean,
  ): Promise<void> => {
    if (!settings) return;

    const updatedSettings: AppSettings = {
      ...settings,
      [key]: value,
    };

    await saveSettings(updatedSettings);
  };

  const handleResetToDefaults = async (): Promise<void> => {
    const result = await confirm(
      "Are you sure you want to reset all settings to their default values? This action cannot be undone.",
      "Cancel",
      "Reset to Defaults",
    );

    if (!result) {
      return;
    }

    if (result) {
      await saveSettings(DEFAULT_SETTINGS);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-container" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="settings-loading">
            <i className="fa-solid fa-spinner" /> Loading settings...
          </div>
        )}

        {error && <div className="settings-error">{error}</div>}

        {settings && (
          <div className="settings-content">
            {/* Editor Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-code" /> Editor
              </h3>

              <div className="setting-item">
                <label className="setting-label">
                  Font Size
                  <span className="setting-value">
                    {settings.editor_font_size}px
                  </span>
                </label>
                <div className="setting-input-group">
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={settings.editor_font_size}
                    onChange={(e) =>
                      handleSettingChange(
                        "editor_font_size",
                        parseInt(e.target.value),
                      )
                    }
                    className="setting-range"
                  />
                </div>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.editor_word_wrap}
                    onChange={(e) =>
                      handleSettingChange("editor_word_wrap", e.target.checked)
                    }
                    className="setting-checkbox"
                  />
                  Word Wrap
                </label>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.editor_line_numbers}
                    onChange={(e) =>
                      handleSettingChange(
                        "editor_line_numbers",
                        e.target.checked,
                      )
                    }
                    className="setting-checkbox"
                  />
                  Line Numbers
                </label>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.editor_minimap}
                    onChange={(e) =>
                      handleSettingChange("editor_minimap", e.target.checked)
                    }
                    className="setting-checkbox"
                  />
                  Minimap
                </label>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.editor_render_whitespace}
                    onChange={(e) =>
                      handleSettingChange(
                        "editor_render_whitespace",
                        e.target.checked,
                      )
                    }
                    className="setting-checkbox"
                  />
                  Render Whitespace
                </label>
              </div>
            </div>

            {/* Terminal Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-terminal" /> Terminal
              </h3>

              <div className="setting-item">
                <label className="setting-label">
                  Font Size
                  <span className="setting-value">
                    {settings.terminal_font_size}px
                  </span>
                </label>
                <div className="setting-input-group">
                  <input
                    type="range"
                    min="10"
                    max="18"
                    value={settings.terminal_font_size}
                    onChange={(e) =>
                      handleSettingChange(
                        "terminal_font_size",
                        parseInt(e.target.value),
                      )
                    }
                    className="setting-range"
                  />
                </div>
              </div>
            </div>

            {/* UI Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-window-maximize" /> UI
              </h3>

              <div className="setting-item">
                <label className="setting-label">
                  Sidebar Width
                  <span className="setting-value">
                    {settings.sidebar_width}px
                  </span>
                </label>
                <div className="setting-input-group">
                  <input
                    type="range"
                    min="180"
                    max="400"
                    step="10"
                    value={settings.sidebar_width}
                    onChange={(e) =>
                      handleSettingChange(
                        "sidebar_width",
                        parseInt(e.target.value),
                      )
                    }
                    className="setting-range"
                  />
                </div>
              </div>
            </div>

            {/* Auto Save Settings */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-floppy-disk" /> Auto Save
              </h3>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.auto_save_enabled}
                    onChange={(e) =>
                      handleSettingChange("auto_save_enabled", e.target.checked)
                    }
                    className="setting-checkbox"
                  />
                  Enable Auto Save
                </label>
              </div>

              {settings.auto_save_enabled && (
                <div className="setting-item">
                  <label className="setting-label">
                    Auto Save Interval
                    <span className="setting-value">
                      {settings.auto_save_interval / 1000}s
                    </span>
                  </label>
                  <div className="setting-input-group">
                    <input
                      type="range"
                      min="1000"
                      max="30000"
                      step="1000"
                      value={settings.auto_save_interval}
                      onChange={(e) =>
                        handleSettingChange(
                          "auto_save_interval",
                          parseInt(e.target.value),
                        )
                      }
                      className="setting-range"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-keyboard" /> Keyboard Shortcuts
              </h3>

              <div className="shortcuts-grid">
                <div className="shortcut-item">
                  <span className="shortcut-action">Open Settings</span>
                  <kbd className="shortcut-key">Ctrl+,</kbd>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-action">Save File</span>
                  <kbd className="shortcut-key">Ctrl+S</kbd>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-action">Close Tab</span>
                  <kbd className="shortcut-key">Ctrl+W</kbd>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-action">Toggle Terminal</span>
                  <kbd className="shortcut-key">Ctrl+J</kbd>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-action">Toggle Sidebar</span>
                  <kbd className="shortcut-key">Ctrl+B</kbd>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-action">Open Folder</span>
                  <kbd className="shortcut-key">Ctrl+O</kbd>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="settings-section">
              <h3 className="settings-section-title">
                <i className="fa-solid fa-circle-info" /> About
              </h3>
              <div className="about-info">
                <p>
                  <strong>XD's Code</strong>
                </p>
                <p>Version 0.7.3</p>
                <p>A code editor inspired by Visual Studio Code</p>
                <p className="about-copy">&copy; 2025 XDPXI</p>
              </div>
            </div>

            {/* Reset Button */}
            <div className="settings-section">
              <button
                className="reset-defaults-btn"
                onClick={handleResetToDefaults}
              >
                <i className="fa-solid fa-arrow-rotate-left" /> Reset to
                Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
