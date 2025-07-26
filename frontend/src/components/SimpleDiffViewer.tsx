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

function classifyDiffLine(line: string, currentFilePath: string): DiffLine {
  if (line.startsWith('diff --git')) {
    // Extract file path from "diff --git a/path/to/file b/path/to/file"
    // This ensures git diff lines are immediately clickable, but "--- a/" line will be canonical
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    const filePath = match ? match[1] : undefined;
    return { type: 'meta', content: line, filePath, isClickable: !!filePath };
  }

  if (line.startsWith('index ')) {
    return { type: 'meta', content: line };
  }

  if (line.startsWith('--- a/')) {
    // CANONICAL file path extraction - this line exists in both git and traditional diff formats
    // This will override any file path from "diff --git" line and set the definitive file path
    const match = line.match(/^--- a\/(.+)$/);
    const filePath = match ? match[1] : undefined;
    return { type: 'header', content: line, filePath, isClickable: !!filePath };
  }

  if (line.startsWith('+++ b/')) {
    // Use the current file path for +++ lines (make them clickable too)
    return {
      type: 'header',
      content: line,
      filePath: currentFilePath,
      isClickable: !!currentFilePath,
    };
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
      filePath: currentFilePath,
      isClickable: !!(lineNumber && currentFilePath),
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

function shouldFilterDiffSection(
  lines: string[],
  startIndex: number
): { shouldFilter: boolean; isRisky: boolean } {
  let filePath = '';
  let hasGitDiffLine = false;
  let isNewFileGit = false;
  let startsFromLineZero = false;

  // Look at the current line and a few lines ahead to gather context
  for (let i = startIndex; i < Math.min(startIndex + 10, lines.length); i++) {
    const line = lines[i];

    // Stop looking once we hit the next diff section (but not the first one)
    if (
      i > startIndex &&
      (line.startsWith('diff --git') || line.startsWith('--- a/'))
    ) {
      break;
    }

    // Check for git diff format
    if (line.startsWith('diff --git')) {
      hasGitDiffLine = true;
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (match) {
        filePath = match[2]; // Use the "new" path (b/path)
      }
    }

    // Extract file path from traditional diff format (always override - this is canonical)
    if (line.startsWith('--- a/')) {
      const match = line.match(/^--- a\/(.+)$/);
      if (match) {
        filePath = match[1]; // Always use this as canonical source
      }
    }

    // Check for git new file indicators
    if (line.startsWith('new file mode') || line === '--- /dev/null') {
      isNewFileGit = true;
    }

    // Check for traditional diff new file indicator (starts from line 0)
    if (line.startsWith('@@') && line.match(/^@@\s*-0,0\s*\+/)) {
      startsFromLineZero = true;
    }
  }

  // Safe filtering: Dockerfiles (never risky)
  if (filePath === 'Dockerfile' || filePath.endsWith('.dockerfile')) {
    return { shouldFilter: true, isRisky: false };
  }

  // Check if this is a top-level file (no directory separators)
  const isTopLevelFile = !filePath.includes('/');

  // Check if this is in a tests/ directory
  const isInTestsDirectory =
    filePath.startsWith('tests/') || filePath.includes('/tests/');

  if (isTopLevelFile || isInTestsDirectory) {
    // Git format new file: filter without warning
    if (hasGitDiffLine && isNewFileGit) {
      return { shouldFilter: true, isRisky: false };
    }

    // Traditional diff inferred new file: filter with warning
    if (!hasGitDiffLine && startsFromLineZero) {
      return { shouldFilter: true, isRisky: true };
    }
  }

  // Conservative: don't filter anything else
  return { shouldFilter: false, isRisky: false };
}

function hasFilterableContent(diffText: string): {
  hasFilterable: boolean;
  hasRisky: boolean;
} {
  if (!diffText.trim()) return { hasFilterable: false, hasRisky: false };

  const lines = diffText.split('\n');
  let hasFilterable = false;
  let hasRisky = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git') || line.startsWith('--- a/')) {
      const result = shouldFilterDiffSection(lines, i);
      if (result.shouldFilter) {
        hasFilterable = true;
        if (result.isRisky) {
          hasRisky = true;
        }
      }
    }
  }
  return { hasFilterable, hasRisky };
}

function parseDiffLines(
  lines: string[],
  hideAuxiliaryFiles: boolean = false
): DiffLine[] {
  if (!hideAuxiliaryFiles) {
    // If filtering is disabled, use the original logic
    const diffLines: DiffLine[] = [];
    let currentFileIsNew = false;
    let currentFilePath = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Reset new file flag when starting a new diff
      if (line.startsWith('diff --git') || line.startsWith('--- a/')) {
        currentFileIsNew = false;
      }

      const diffLine = classifyDiffLine(line, currentFilePath);

      // Update current file path when we find one
      if (diffLine.filePath) {
        currentFilePath = diffLine.filePath;
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
    if (line.startsWith('diff --git') || line.startsWith('--- a/')) {
      const filterResult = shouldFilterDiffSection(lines, i);
      if (filterResult.shouldFilter) {
        // Skip this entire diff section - find the end
        let sectionEnd = i + 1;
        while (
          sectionEnd < lines.length &&
          !lines[sectionEnd].startsWith('diff --git') &&
          !lines[sectionEnd].startsWith('--- a/')
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
  let currentFilePath = '';

  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];

    // Reset new file flag when starting a new diff
    if (line.startsWith('diff --git') || line.startsWith('--- a/')) {
      currentFileIsNew = false;
    }

    const diffLine = classifyDiffLine(line, currentFilePath);

    // Update current file path when we find one
    if (diffLine.filePath) {
      currentFilePath = diffLine.filePath;
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
        // Update current file path when we encounter any line with a file path
        if (diffLine.filePath) {
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
