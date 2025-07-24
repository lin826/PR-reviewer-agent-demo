import type { FC } from 'react';
import type { DraftStatus } from '../services/draftManager';

interface StatusBarProps {
  draftStatus: DraftStatus;
  canCommit: boolean;
  hasUncommittedChanges: boolean;
  isCommitting: boolean;
  onCommit: () => void;
  onDiscard: () => void;
}

export const StatusBar: FC<StatusBarProps> = ({
  draftStatus,
  canCommit,
  hasUncommittedChanges,
  isCommitting,
  onCommit,
  onDiscard,
}) => {
  const getStatusMessage = (): {
    message: string;
    emoji: string;
    color: string;
  } | null => {
    switch (draftStatus) {
      case 'committed':
        return {
          message: 'Saved',
          emoji: '✅',
          color: '#22c55e', // green
        };
      case 'committing':
        return {
          message: 'Saving...',
          emoji: '💾',
          color: '#3b82f6', // blue
        };
      case 'uncommitted':
        return {
          message: 'Draft',
          emoji: '📝',
          color: '#f59e0b', // orange
        };
      case 'autosave_triggered':
        return {
          message: 'Draft (autosaving...)',
          emoji: '📝',
          color: '#f59e0b', // orange
        };
      case 'error':
        return {
          message: 'Save failed - retry?',
          emoji: '❌',
          color: '#ef4444', // red
        };
      case null:
        return null; // No status to display
      default:
        return {
          message: 'Unknown status',
          emoji: '❓',
          color: '#6b7280', // gray
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="status-bar">
      <div className="status-info">
        {statusMessage && (
          <span
            className="status-indicator"
            style={{ color: statusMessage.color }}
          >
            {statusMessage.emoji} {statusMessage.message}
          </span>
        )}
      </div>

      <div className="status-actions">
        {hasUncommittedChanges && (
          <>
            <button
              type="button"
              className="discard-button"
              onClick={onDiscard}
              disabled={isCommitting}
            >
              Revert
            </button>
            <button
              type="button"
              className="commit-button"
              onClick={onCommit}
              disabled={!canCommit || isCommitting}
            >
              Commit
            </button>
          </>
        )}
      </div>
    </div>
  );
};
