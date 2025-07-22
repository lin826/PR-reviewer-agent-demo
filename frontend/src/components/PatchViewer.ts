import { apiClient } from '../services/api.js';
import type { PatchContent } from '../types/index.js';

export class PatchViewer {
  private groundTruthElement: HTMLElement;
  private agentSubmissionElement: HTMLElement;
  private currentProblemId: string | null = null;
  private currentAgentName: string | null = null;

  constructor(
    groundTruthElement: HTMLElement,
    agentSubmissionElement: HTMLElement
  ) {
    this.groundTruthElement = groundTruthElement;
    this.agentSubmissionElement = agentSubmissionElement;
  }

  public async loadPatches(
    problemId: string | null,
    agentName: string | null
  ): Promise<void> {
    this.currentProblemId = problemId;
    this.currentAgentName = agentName;

    // Clear both panels first
    this.clearPanel(
      this.groundTruthElement,
      'Select a problem to view ground truth patch'
    );
    this.clearPanel(
      this.agentSubmissionElement,
      'Select an agent and problem to view submission'
    );

    if (!problemId) {
      return;
    }

    try {
      // Load ground truth patch (always load if problem is selected)
      await this.loadGroundTruthPatch(problemId);

      // Load agent submission (only if both problem and agent are selected)
      if (agentName) {
        await this.loadAgentSubmission(problemId, agentName);
      }
    } catch (error) {
      console.error('Failed to load patches:', error);
    }
  }

  private async loadGroundTruthPatch(problemId: string): Promise<void> {
    try {
      this.setLoading(this.groundTruthElement, 'Loading ground truth patch...');

      const patch = await apiClient.getGroundTruthPatch(problemId);
      console.log(
        `Loaded ground truth patch for ${problemId}: ${patch.stats.file_count} files, ${patch.stats.additions} additions, ${patch.stats.deletions} deletions`
      );

      this.renderPatch(this.groundTruthElement, patch);
    } catch (error) {
      console.error(
        `Failed to load ground truth patch for ${problemId}:`,
        error
      );
      this.setError(
        this.groundTruthElement,
        'Failed to load ground truth patch'
      );
    }
  }

  private async loadAgentSubmission(
    problemId: string,
    agentName: string
  ): Promise<void> {
    try {
      this.setLoading(
        this.agentSubmissionElement,
        'Loading agent submission...'
      );

      const patch = await apiClient.getAgentPatch(problemId, agentName);
      console.log(
        `Loaded agent patch for ${problemId}/${agentName}: ${patch.stats.file_count} files, ${patch.stats.additions} additions, ${patch.stats.deletions} deletions`
      );

      this.renderPatch(this.agentSubmissionElement, patch);
    } catch (error) {
      console.error(
        `Failed to load agent patch for ${problemId}/${agentName}:`,
        error
      );

      // Check if it's a 404 (no patch available)
      if (error instanceof Error && error.message.includes('404')) {
        this.setNoPatch(this.agentSubmissionElement, agentName);
      } else {
        this.setError(
          this.agentSubmissionElement,
          'Failed to load agent submission'
        );
      }
    }
  }

  private renderPatch(element: HTMLElement, patch: PatchContent): void {
    // Clear the element
    element.innerHTML = '';

    // Check if this is a placeholder/invalid patch (like ground truth placeholder)
    if (!patch.is_valid && patch.stats.file_count === 0) {
      // Render placeholder content differently
      const placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'ground-truth-placeholder';

      // Convert markdown-style content to HTML
      const htmlContent = patch.content
        .replace(/^# (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gm, '<p>$1</p>')
        .replace(/<p><\/p>/g, '');

      placeholderDiv.innerHTML = htmlContent;
      element.appendChild(placeholderDiv);
      return;
    }

    // Create patch metadata header for real patches
    const header = document.createElement('div');
    header.className = 'patch-header';
    header.innerHTML = `
      <div class="patch-stats">
        <span class="file-count">${patch.stats.file_count} file${patch.stats.file_count !== 1 ? 's' : ''}</span>
        <span class="addition-count">+${patch.stats.additions}</span>
        <span class="deletion-count">-${patch.stats.deletions}</span>
      </div>
    `;

    // Create patch content area
    const content = document.createElement('div');
    content.className = 'patch-content';

    if (patch.content.trim()) {
      // Apply basic diff highlighting
      const highlightedContent = this.highlightDiff(patch.content);
      content.innerHTML = highlightedContent;
    } else {
      content.innerHTML =
        '<div class="placeholder">No patch content available</div>';
    }

    element.appendChild(header);
    element.appendChild(content);
  }

  private highlightDiff(content: string): string {
    const lines = content.split('\n');
    const highlightedLines = lines.map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return `<div class="diff-file-header">${this.escapeHtml(line)}</div>`;
      } else if (line.startsWith('+')) {
        return `<div class="diff-addition">${this.escapeHtml(line)}</div>`;
      } else if (line.startsWith('-')) {
        return `<div class="diff-deletion">${this.escapeHtml(line)}</div>`;
      } else if (line.startsWith('@@')) {
        return `<div class="diff-hunk-header">${this.escapeHtml(line)}</div>`;
      } else {
        return `<div class="diff-context">${this.escapeHtml(line) || '&nbsp;'}</div>`;
      }
    });

    return highlightedLines.join('');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private clearPanel(element: HTMLElement, placeholderText: string): void {
    element.innerHTML = `<div class="placeholder">${placeholderText}</div>`;
  }

  private setLoading(element: HTMLElement, message: string): void {
    element.innerHTML = `<div class="placeholder loading">${message}</div>`;
  }

  private setError(element: HTMLElement, message: string): void {
    element.innerHTML = `<div class="placeholder error">${message}</div>`;
  }

  private setNoPatch(element: HTMLElement, agentName: string): void {
    element.innerHTML = `
      <div class="no-patch">
        <div class="no-patch-icon">📄</div>
        <div class="no-patch-message">No patch submitted by ${agentName}</div>
        <div class="no-patch-subtitle">This agent did not generate a patch for this problem</div>
      </div>
    `;
  }

  public getCurrentProblem(): string | null {
    return this.currentProblemId;
  }

  public getCurrentAgent(): string | null {
    return this.currentAgentName;
  }
}
