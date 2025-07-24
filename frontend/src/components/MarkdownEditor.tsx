import React, { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as monaco from 'monaco-editor';
import 'github-markdown-css/github-markdown-light.css';
import '../styles/markdown-tweaks.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (_value: string) => void;
  onSave: () => void;
  disabled?: boolean;
  _placeholder?: string;
  isRendered?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  disabled = false,
  isRendered = false,
}) => {
  const handleEditorDidMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      // Add keyboard shortcut for save (Ctrl+S / Cmd+S)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });

      // Define a custom theme with better markdown highlighting
      monaco.editor.defineTheme('markdown-theme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword.md', foreground: '0066cc', fontStyle: 'bold' }, // Headers
          { token: 'emphasis.md', foreground: '000000', fontStyle: 'italic' }, // Italic
          { token: 'strong.md', foreground: '000000', fontStyle: 'bold' }, // Bold
          { token: 'string.md', foreground: '#032f62' }, // Code blocks
          { token: 'keyword.other.md', foreground: '#005cc5' }, // Links
          {
            token: 'markup.inline.raw.md',
            foreground: '#032f62',
            background: '#f6f8fa',
          }, // Inline code
          {
            token: 'markup.fenced_code.block.md',
            foreground: '#032f62',
            background: '#f6f8fa',
          }, // Code blocks
        ],
        colors: {
          'editor.background': '#fafafa',
          'editor.foreground': '#000000',
        },
      });

      // Apply the custom theme
      monaco.editor.setTheme('markdown-theme');

      // Ensure markdown language is properly loaded and configured
      const model = editor.getModel();
      if (model) {
        // Force markdown language mode
        monaco.editor.setModelLanguage(model, 'markdown');
      }
    },
    [onSave]
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      onChange(value || '');
    },
    [onChange]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fafafa', // Match patch viewer background
        border: 'none',
        padding: '8px', // Back to padding on all sides
      }}
    >
      {isRendered ? (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}
        >
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value || ''}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on', // Enable line numbers
            glyphMargin: false, // Remove glyph margin to reduce left space
            folding: false,
            lineNumbersMinChars: 4, // Wider minimum width for line numbers
            renderLineHighlight: 'line',
            contextmenu: true,
            // Match patch viewer font settings exactly
            fontSize: 13, // Slightly smaller than before to match diff better
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace', // Match patch viewer font
            lineHeight: 1.4, // Match patch viewer line height
            readOnly: disabled,
            // Disable all suggestions for clean experience
            quickSuggestions: false,
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: 'off',
            tabCompletion: 'off',
            wordBasedSuggestions: 'off',
            // Clean padding since no border
            padding: { top: 16, bottom: 16 },
          }}
          theme="markdown-theme"
        />
      )}
    </div>
  );
};
