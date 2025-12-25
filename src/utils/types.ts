interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

interface DirectoryContents {
  entries: FileEntry[];
  current_path: string;
}

interface OpenFile {
  name: string;
  path: string;
  content: string;
}

interface ContextMenu {
  x: number;
  y: number;
  type: "file" | "folder" | "empty";
  entry?: FileEntry;
}

interface OpenFile {
  name: string;
  path: string;
  content: string;
}

type GitFileStatus = "untracked" | "modified" | "staged" | "unmodified";

interface GitFileInfo {
  path: string;
  status: GitFileStatus;
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
