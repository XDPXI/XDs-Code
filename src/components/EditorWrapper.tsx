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
  onContentChange?: (newContent: string) => void;
}

const EditorWrapper: React.FC<EditorWrapperProps> = ({
  currentFile,
  fileContent,
  contentRef,
  setFileContent,
  isDirtyRef,
  defineCustomTheme,
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
      fontSize: 14,
      minimap: { enabled: false },
      wordWrap: "on",
      scrollBeyondLastLine: false,
      lineNumbers: "on",
      renderLineHighlight: "all",
      automaticLayout: true,
    }}
  />
);

export default EditorWrapper;
