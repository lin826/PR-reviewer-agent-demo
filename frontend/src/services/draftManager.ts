/**
 * DraftManager - Handles file-based storage of draft label content
 */

import { apiClient } from './api';

export type DraftStatus =
  | 'committed' // Content matches committed label (saved to server)
  | 'committing' // Currently saving to server
  | 'uncommitted' // Content differs from committed label (draft)
  | 'autosave_triggered' // Draft with autosave scheduled (UI shows "Draft (autosaving)")
  | 'error' // Save operation failed
  | null; // No status (both current and committed content are empty)

class DraftManager {
  /**
   * Save a draft to disk via API
   */
  async saveDraft(
    problemId: string,
    agentName: string,
    content: string
  ): Promise<void> {
    try {
      await apiClient.saveDraft(problemId, agentName, content);
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw new Error('Failed to save draft to disk');
    }
  }

  /**
   * Load a draft from disk via API
   */
  async loadDraft(
    problemId: string,
    agentName: string
  ): Promise<{ content: string } | null> {
    try {
      return await apiClient.getDraft(problemId, agentName);
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }

  /**
   * Delete a draft from disk via API
   */
  async deleteDraft(problemId: string, agentName: string): Promise<void> {
    try {
      await apiClient.deleteDraft(problemId, agentName);
    } catch (error) {
      console.error('Failed to delete draft:', error);
      // Don't throw - deletion failures should be non-fatal
    }
  }

  /**
   * Commit a draft by moving it to the label file
   */
  async commitDraft(problemId: string, agentName: string) {
    try {
      return await apiClient.commitDraft(problemId, agentName);
    } catch (error) {
      console.error('Failed to commit draft:', error);
      throw new Error('Failed to commit draft');
    }
  }
}

// Export singleton instance
export const draftManager = new DraftManager();
