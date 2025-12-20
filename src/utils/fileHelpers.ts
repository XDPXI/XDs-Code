export const getMonacoLanguage = (filename: string): string => {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "jsx":
      return "javascript";
    case "html":
    case "htm":
      return "html";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "py":
      return "python";
    case "c":
    case "cpp":
    case "h":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "java":
      return "java";
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    case "rs":
      return "rust";
    case "toml":
      return "toml";
    case "go":
      return "go";
    default:
      return "plaintext";
  }
};

export const getFileIcon = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    // JavaScript/TypeScript
    case "js":
    case "mjs":
    case "cjs":
    case "ts":
      return "fa-brands fa-js";
    case "tsx":
    case "jsx":
      return "fa-brands fa-react";
    case "vue":
      return "fa-brands fa-vuejs";
    case "angular":
    case "ng":
      return "fa-brands fa-angular";

    // Web Technologies
    case "html":
    case "htm":
      return "fa-brands fa-html5";
    case "css":
    case "scss":
    case "sass":
    case "less":
      return "fa-brands fa-css3-alt";
    case "bootstrap":
      return "fa-brands fa-bootstrap";

    // Programming Languages
    case "java":
    case "class":
    case "jar":
      return "fa-brands fa-java";
    case "py":
    case "pyc":
    case "pyo":
    case "pyw":
      return "fa-brands fa-python";
    case "php":
    case "phtml":
      return "fa-brands fa-php";
    case "go":
    case "mod":
      return "fa-brands fa-golang";
    case "rs":
    case "toml":
      return "fa-brands fa-rust";
    case "swift":
      return "fa-brands fa-swift";
    case "rb":
    case "ruby":
    case "gem":
      return "fa-solid fa-gem";
    case "c":
    case "h":
      return "fa-solid fa-code";
    case "cpp":
    case "cxx":
    case "cc":
    case "hpp":
      return "fa-solid fa-code";
    case "cs":
      return "fa-solid fa-code";
    case "vb":
    case "vbs":
      return "fa-solid fa-code";
    case "pl":
    case "pm":
      return "fa-solid fa-code";
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return "fa-solid fa-terminal";
    case "bat":
    case "cmd":
      return "fa-solid fa-terminal";
    case "ps1":
    case "psm1":
      return "fa-solid fa-terminal";
    case "r":
    case "rmd":
      return "fa-brands fa-r-project";
    case "scala":
      return "fa-solid fa-code";
    case "kt":
    case "kts":
      return "fa-solid fa-code";
    case "dart":
      return "fa-solid fa-code";
    case "lua":
      return "fa-solid fa-code";
    case "erl":
    case "hrl":
      return "fa-brands fa-erlang";

    // Database
    case "sql":
    case "mysql":
    case "pgsql":
    case "sqlite":
    case "db":
      return "fa-solid fa-database";

    // Configuration Files
    case "json":
    case "jsonc":
    case "xml":
    case "xsl":
    case "xsd":
      return "fa-solid fa-code";
    case "yaml":
    case "yml":
      return "fa-solid fa-file-lines";
    case "ini":
    case "cfg":
    case "conf":
    case "config":
      return "fa-solid fa-gear";
    case "env":
    case "environment":
      return "fa-solid fa-gear";
    case "dockerignore":
    case "dockerfile":
      return "fa-brands fa-docker";

    // Version Control
    case "gitignore":
    case "gitattributes":
    case "git":
      return "fa-brands fa-git-alt";

    // Documentation
    case "md":
    case "markdown":
    case "mdx":
      return "fa-brands fa-markdown";
    case "txt":
    case "text":
      return "fa-solid fa-file-lines";
    case "rtf":
      return "fa-solid fa-file-lines";
    case "readme":
      return "fa-solid fa-circle-info";
    case "license":
    case "licence":
      return "fa-solid fa-scale-balanced";
    case "changelog":
    case "changes":
      return "fa-solid fa-list";

    // Office Documents
    case "doc":
    case "docx":
      return "fa-brands fa-microsoft";
    case "xls":
    case "xlsx":
    case "csv":
      return "fa-solid fa-file-excel";
    case "ppt":
    case "pptx":
      return "fa-solid fa-file-powerpoint";
    case "pdf":
      return "fa-solid fa-file-pdf";
    case "odt":
    case "ods":
    case "odp":
      return "fa-solid fa-file-lines";

    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "bmp":
    case "tiff":
    case "tif":
    case "webp":
    case "avif":
    case "heic":
    case "heif":
      return "fa-regular fa-image";
    case "svg":
      return "fa-solid fa-vector-square";
    case "ico":
    case "icns":
      return "fa-solid fa-icons";
    case "psd":
    case "ai":
    case "eps":
      return "fa-solid fa-paintbrush";
    case "fig":
    case "figma":
      return "fa-brands fa-figma";
    case "sketch":
      return "fa-brands fa-sketch";

    // Audio
    case "mp3":
    case "wav":
    case "flac":
    case "aac":
    case "ogg":
    case "wma":
    case "m4a":
    case "opus":
      return "fa-solid fa-music";

    // Video
    case "mp4":
    case "avi":
    case "mkv":
    case "mov":
    case "wmv":
    case "flv":
    case "webm":
    case "m4v":
    case "3gp":
    case "ogv":
      return "fa-solid fa-film";

    // Archives
    case "zip":
    case "7z":
    case "rar":
    case "tar":
    case "gz":
    case "bz2":
    case "xz":
    case "z":
    case "lz":
    case "lzma":
    case "cab":
    case "deb":
    case "rpm":
    case "dmg":
    case "pkg":
    case "msi":
    case "exe":
    case "app":
      return "fa-solid fa-file-zipper";

    // Fonts
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
    case "eot":
      return "fa-solid fa-font";

    // 3D/CAD
    case "obj":
    case "fbx":
    case "dae":
    case "gltf":
    case "glb":
    case "3ds":
    case "blend":
    case "max":
    case "maya":
    case "dwg":
    case "dxf":
      return "fa-solid fa-cube";

    // Package Managers
    case "npm":
    case "yarn":
      return "fa-brands fa-npm";
    case "composer":
      return "fa-solid fa-box";
    case "pip":
    case "pipfile":
      return "fa-brands fa-python";
    case "cargo":
      return "fa-brands fa-rust";
    case "gemfile":
      return "fa-solid fa-gem";
    case "podfile":
      return "fa-solid fa-box";

    // Build/Task Files
    case "makefile":
    case "make":
      return "fa-solid fa-hammer";
    case "cmake":
      return "fa-solid fa-hammer";
    case "gradle":
      return "fa-solid fa-hammer";
    case "gulpfile":
    case "gruntfile":
      return "fa-solid fa-hammer";
    case "webpack":
      return "fa-solid fa-cube";
    case "rollup":
    case "vite":
      return "fa-solid fa-cube";

    // Certificates/Keys
    case "pem":
    case "crt":
    case "cert":
    case "cer":
    case "p12":
    case "pfx":
    case "key":
    case "pub":
      return "fa-solid fa-key";

    // Log Files
    case "log":
    case "logs":
      return "fa-solid fa-file-lines";

    // Temporary/Cache
    case "tmp":
    case "temp":
    case "cache":
    case "bak":
    case "backup":
    case "old":
      return "fa-solid fa-clock-rotate-left";

    // Default
    default:
      return "fa-regular fa-file";
  }
};

export const isImageFile = (filename: string) => {
  return /\.(png|ico|jpe?g|gif|webp|svg)$/i.test(filename);
};

export const isVideoFile = (filename: string) => {
  return /\.(mp4|webm|ogg|mov)$/i.test(filename);
};
