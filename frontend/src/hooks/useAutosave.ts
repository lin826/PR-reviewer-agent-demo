import { useCallback, useEffect, useRef } from 'react';
import { draftManager } from '../services/draftManager';

interface UseAutosaveOptions {
  content: string;
  problemId: string | null;
  agentName: string | null;
  isDraft: boolean; // Only autosave when this is true
  delay?: number; // Autosave delay in milliseconds
  onAutosaveStart?: () => void; // Called when autosave starts
  onAutosaveComplete?: () => void; // Called after autosave completes
}

interface UseAutosaveReturn {
  saveDraftNow: () => Promise<void>;
  deleteDraft: () => Promise<void>;
  hasDraft: boolean;
}

export function useAutosave({
  content,
  problemId,
  agentName,
  isDraft,
  delay = 500,
  onAutosaveStart,
  onAutosaveComplete,
}: UseAutosaveOptions): UseAutosaveReturn {
  const timeoutRef = useRef<number | null>(null);
  const lastContentRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);

  const saveDraftNow = useCallback(async () => {
    if (!problemId || !agentName) return;

    try {
      onAutosaveStart?.();
      await draftManager.saveDraft(problemId, agentName, content);
      lastContentRef.current = content;

      // Notify parent that autosave completed
      onAutosaveComplete?.();
    } catch (error) {
      console.error('Failed to save draft:', error);
      // For now, just log the error - parent should handle error states
    }
  }, [problemId, agentName, content, onAutosaveStart, onAutosaveComplete]);

  const deleteDraft = useCallback(async () => {
    if (!problemId || !agentName) return;

    await draftManager.deleteDraft(problemId, agentName);
    lastContentRef.current = '';
  }, [problemId, agentName]);

  // Note: hasDraft is no longer synchronous with file-based storage
  // This will need to be handled differently by the parent component
  const hasDraft = false;

  // Debounced autosave effect - only runs when isDraft is true
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Don't autosave if we don't have valid selections or not in draft state
    if (!problemId || !agentName || !isDraft) {
      return;
    }

    // Don't autosave on initial load or if content hasn't changed
    if (isInitialLoadRef.current || content === lastContentRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Set up debounced save
    timeoutRef.current = window.setTimeout(() => {
      saveDraftNow();
    }, delay);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [content, problemId, agentName, isDraft, delay, saveDraftNow]);

  // Reset initial load flag when selections change
  useEffect(() => {
    isInitialLoadRef.current = true;
    lastContentRef.current = '';
  }, [problemId, agentName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    saveDraftNow,
    deleteDraft,
    hasDraft,
  };
}
