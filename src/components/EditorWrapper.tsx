import React from "react";
import Editor from "@monaco-editor/react";
import { getMonacoLanguage } from "../utils/fileHelpers";

interface EditorWrapperProps {
  currentFile: string | null;
  fileContent: string;
  contentRef: React.RefObject<string>;
  setFileContent: (content: string) => void;
  isDirtyRef: React.RefObject<boolean>;
  defineCustomTheme: (monaco: typeof import("monaco-editor")) => void;
  settings: AppSettings | null;
  onContentChange?: (newContent: string) => void;
}

const EditorWrapper: React.FC<EditorWrapperProps> = ({
  currentFile,
  fileContent,
  contentRef,
  setFileContent,
  isDirtyRef,
  defineCustomTheme,
  settings,
  onContentChange,
}) => (
  <Editor
    height="100%"
    language={getMonacoLanguage(
      currentFile
        ? currentFile.split("/").pop() || currentFile.split("\\").pop() || ""
        : "",
    )}
    value={fileContent}
    onChange={(value) => {
      const newContent = value || "";
      contentRef.current = newContent;
      setFileContent(newContent);
      isDirtyRef.current = true;
      onContentChange?.(newContent);
    }}
    beforeMount={defineCustomTheme}
    theme="xd-dark"
    options={{
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: settings?.editor_font_size || 14,
      minimap: { enabled: settings?.editor_minimap || false },
      wordWrap: settings?.editor_word_wrap ? "on" : "off",
      scrollBeyondLastLine: false,
      lineNumbers: settings?.editor_line_numbers ? "on" : "off",
      renderLineHighlight: "all",
      automaticLayout: true,
      renderWhitespace: settings?.editor_render_whitespace ? "all" : "none",
    }}
  />
);

export default EditorWrapper;
