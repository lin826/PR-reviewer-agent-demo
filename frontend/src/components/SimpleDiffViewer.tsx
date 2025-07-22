import React from 'react';

interface SimpleDiffViewerProps {
  diffText: string;
  placeholder?: string;
  baseCommitUrl?: string;
}

interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'header' | 'hunk' | 'meta';
  content: string;
  lineNumber?: number;
  filePath?: string;
  isClickable?: boolean;
  isNewFile?: boolean;
}

function classifyDiffLine(line: string): DiffLine {
  if (line.startsWith('diff --git')) {
    // Extract file path from "diff --git a/path/to/file b/path/to/file"
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    const filePath = match ? match[1] : undefined; // Use the "old" path (a/path)
    return { type: 'meta', content: line, filePath, isClickable: !!filePath };
  }

  if (line.startsWith('index ')) {
    return { type: 'meta', content: line };
  }

  if (line.startsWith('---') || line.startsWith('+++')) {
    return { type: 'header', content: line };
  }

  if (line.startsWith('@@')) {
    // Extract line number from "@@ -156,11 +156,31 @@"
    const match = line.match(/^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
    const lineNumber = match ? parseInt(match[1], 10) : undefined; // Use the original line number
    return {
      type: 'hunk',
      content: line,
      lineNumber,
      isClickable: !!lineNumber,
    };
  }

  if (line.startsWith('+')) {
    return { type: 'added', content: line };
  }

  if (line.startsWith('-')) {
    return { type: 'removed', content: line };
  }

  // Context line (starts with space or is empty)
  return { type: 'context', content: line };
}

function getLineStyles(type: DiffLine['type']) {
  const baseStyles = {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '18px',
    padding: '0 8px',
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
  };

  switch (type) {
    case 'meta':
      return {
        ...baseStyles,
        color: '#ffcb6b',
        fontStyle: 'italic' as const,
        backgroundColor: '#2d2d30',
      };
    case 'header':
      return {
        ...baseStyles,
        color: '#ffffff',
        fontWeight: 'bold' as const,
        backgroundColor: '#2d2d30',
      };
    case 'hunk':
      return {
        ...baseStyles,
        color: '#c792ea',
        fontWeight: 'bold' as const,
        backgroundColor: '#2d2d30',
      };
    case 'added':
      return {
        ...baseStyles,
        color: '#4ec9b0',
        backgroundColor: '#1b4d3e',
      };
    case 'removed':
      return {
        ...baseStyles,
        color: '#f97583',
        backgroundColor: '#4b1113',
      };
    case 'context':
      return {
        ...baseStyles,
        color: '#d4d4d4',
        backgroundColor: '#1e1e1e',
      };
    default:
      return {
        ...baseStyles,
        color: '#d4d4d4',
        backgroundColor: '#1e1e1e',
      };
  }
}

function createGitHubFileUrl(
  baseCommitUrl: string,
  filePath: string,
  lineNumber?: number
): string {
  if (!baseCommitUrl || baseCommitUrl === '#') return '#';

  // Convert tree URL to blob URL and add file path
  const treeUrl = baseCommitUrl.replace('/tree/', '/blob/');
  const url = `${treeUrl}/${filePath}`;

  // Add line number if provided
  return lineNumber ? `${url}#L${lineNumber}` : url;
}

function parseDiffLines(lines: string[]): DiffLine[] {
  const diffLines: DiffLine[] = [];
  let currentFileIsNew = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const diffLine = classifyDiffLine(line);

    // Reset new file flag when starting a new diff
    if (diffLine.type === 'meta' && line.startsWith('diff --git')) {
      currentFileIsNew = false;
    }

    // Check for new file indicators
    if (line.startsWith('new file mode') || line === '--- /dev/null') {
      currentFileIsNew = true;
    }

    // Apply new file flag to meta lines (file headers)
    if (diffLine.type === 'meta' && diffLine.filePath && currentFileIsNew) {
      diffLine.isNewFile = true;
      diffLine.isClickable = false; // Don't make new files clickable
    }

    diffLines.push(diffLine);
  }

  return diffLines;
}

export const SimpleDiffViewer: React.FC<SimpleDiffViewerProps> = ({
  diffText,
  placeholder = 'No diff content to display',
  baseCommitUrl,
}) => {
  if (!diffText.trim()) {
    return (
      <div
        style={{
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: '14px',
          backgroundColor: '#1e1e1e',
        }}
      >
        {placeholder}
      </div>
    );
  }

  const lines = diffText.split('\n');
  const diffLines = parseDiffLines(lines);

  // Track current file for hunk headers
  let currentFilePath = '';

  return (
    <div
      style={{
        backgroundColor: '#1e1e1e',
        border: '1px solid #3e3e42',
        borderRadius: '4px',
        overflow: 'auto',
      }}
    >
      {diffLines.map((diffLine, index) => {
        // Update current file path when we encounter a diff --git line
        if (diffLine.type === 'meta' && diffLine.filePath) {
          currentFilePath = diffLine.filePath;
        }

        // Create clickable link for file headers and hunk headers
        if (diffLine.isClickable && baseCommitUrl) {
          const url =
            diffLine.type === 'meta'
              ? createGitHubFileUrl(baseCommitUrl, diffLine.filePath!)
              : createGitHubFileUrl(
                  baseCommitUrl,
                  currentFilePath,
                  diffLine.lineNumber
                );

          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...getLineStyles(diffLine.type),
                textDecoration: 'none',
                cursor: 'pointer',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  diffLine.type === 'meta' ? '#404040' : '#3d3d3d';
              }}
              onMouseLeave={(e) => {
                const originalStyle = getLineStyles(diffLine.type);
                e.currentTarget.style.backgroundColor =
                  originalStyle.backgroundColor;
              }}
            >
              {diffLine.content || ' '}
            </a>
          );
        }

        // Regular non-clickable line
        return (
          <div key={index} style={getLineStyles(diffLine.type)}>
            {diffLine.content || ' '}
          </div>
        );
      })}
    </div>
  );
};
