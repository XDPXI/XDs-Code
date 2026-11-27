import React, { useMemo } from "react";
import Editor from "@monaco-editor/react";
import { getMonacoLanguage } from "../utils/fileHelpers";

interface EditorWrapperProps {
  currentFile: string | null;
  fileContent: string;
  contentRef: React.RefObject<string>;
  isDirtyRef: React.RefObject<boolean>;
  defineCustomTheme: (monaco: typeof import("monaco-editor")) => void;
  settings: AppSettings | null;
  onContentChange?: (newContent: string) => void;
}

const themeFor = (theme?: string) =>
  theme === "windows-xp"
    ? "vs"
    : theme === "one-light"
      ? "one-light"
      : theme === "legacy"
        ? "vs-dark"
        : "xd-dark";

const EditorWrapper: React.FC<EditorWrapperProps> = ({
  currentFile,
  fileContent,
  contentRef,
  isDirtyRef,
  defineCustomTheme,
  settings,
  onContentChange,
}) => {
  const language = useMemo(
    () => getMonacoLanguage(currentFile?.split(/[\\/]/).pop() || ""),
    [currentFile],
  );

  const fontSize = settings?.editor_font_size || 14;
  const minimap = settings?.editor_minimap || false;
  const wordWrap = settings?.editor_word_wrap ? "on" : "off";
  const lineNumbers = settings?.editor_line_numbers ? "on" : "off";
  const renderWhitespace = settings?.editor_render_whitespace ? "all" : "none";

  const options = useMemo(
    () => ({
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize,
      minimap: { enabled: minimap },
      wordWrap: wordWrap as "on" | "off",
      scrollBeyondLastLine: false,
      lineNumbers: lineNumbers as "on" | "off",
      renderLineHighlight: "all" as const,
      automaticLayout: true,
      renderWhitespace: renderWhitespace as "all" | "none",
    }),
    [fontSize, minimap, wordWrap, lineNumbers, renderWhitespace],
  );

  return (
    <Editor
      height="100%"
      path={currentFile ?? undefined}
      language={language}
      value={fileContent}
      onChange={(value) => {
        const newContent = value ?? "";
        // Ref only: no React state per keystroke.
        contentRef.current = newContent;
        isDirtyRef.current = true;
        onContentChange?.(newContent);
      }}
      beforeMount={defineCustomTheme}
      theme={themeFor(settings?.theme)}
      options={options}
    />
  );
};

export default React.memo(EditorWrapper);
