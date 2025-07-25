import React from 'react';

interface SimpleDiffViewerProps {
  diffText: string;
  placeholder?: string;
  baseCommitUrl?: string;
  hideAuxiliaryFiles?: boolean;
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

function shouldFilterDiffSection(lines: string[], startIndex: number): boolean {
  // Find the file path from the diff --git line
  let filePath = '';
  let isNewFile = false;

  // Look at the current line and a few lines ahead to gather context
  for (let i = startIndex; i < Math.min(startIndex + 10, lines.length); i++) {
    const line = lines[i];

    // Stop looking once we hit the next diff section (but not the first one)
    if (i > startIndex && line.startsWith('diff --git')) {
      break;
    }

    // Extract file path from diff --git line (only from the starting line)
    if (i === startIndex && line.startsWith('diff --git')) {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (match) {
        filePath = match[2]; // Use the "new" path (b/path)
      }
    }

    // Check if this is a new file
    if (line.startsWith('new file mode') || line === '--- /dev/null') {
      isNewFile = true;
    }
  }

  // Filter Dockerfile changes
  if (filePath === 'Dockerfile' || filePath.endsWith('.dockerfile')) {
    return true;
  }

  // Filter newly created test files
  if (isNewFile && filePath.toLowerCase().includes('test')) {
    return true;
  }

  return false;
}

function hasFilterableContent(diffText: string): boolean {
  if (!diffText.trim()) return false;

  const lines = diffText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git')) {
      if (shouldFilterDiffSection(lines, i)) {
        return true;
      }
    }
  }
  return false;
}

function parseDiffLines(
  lines: string[],
  hideAuxiliaryFiles: boolean = false
): DiffLine[] {
  if (!hideAuxiliaryFiles) {
    // If filtering is disabled, use the original logic
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

  // Filtering enabled - filter out entire sections
  const filteredLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // If we hit a diff section, check if we should skip it
    if (line.startsWith('diff --git')) {
      if (shouldFilterDiffSection(lines, i)) {
        // Skip this entire diff section - find the end
        let sectionEnd = i + 1;
        while (
          sectionEnd < lines.length &&
          !lines[sectionEnd].startsWith('diff --git')
        ) {
          sectionEnd++;
        }
        i = sectionEnd - 1; // Will be incremented at end of loop
      } else {
        filteredLines.push(line);
      }
    } else {
      filteredLines.push(line);
    }
    i++;
  }

  // Now parse the filtered lines normally
  const diffLines: DiffLine[] = [];
  let currentFileIsNew = false;

  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
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

export { hasFilterableContent };

export const SimpleDiffViewer: React.FC<SimpleDiffViewerProps> = ({
  diffText,
  placeholder = 'No diff content to display',
  baseCommitUrl,
  hideAuxiliaryFiles = false,
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
  const diffLines = parseDiffLines(lines, hideAuxiliaryFiles);

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
