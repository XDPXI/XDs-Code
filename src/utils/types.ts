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
