import { useState, useCallback, useEffect, type FC } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { SimpleDiffViewer, hasFilterableContent } from './SimpleDiffViewer';
import { StatusBar } from './StatusBar';
import { apiClient } from '../services/api';
import { useAutosave } from '../hooks/useAutosave';
import { draftManager, type DraftStatus } from '../services/draftManager';
import type { Problem, PatchContent, Label } from '../types/index';

interface MainContentProps {
  selectedProblem: string | null;
  selectedAgent: string | null;
  selectedProblemData: Problem | null;
  onUncommittedChangesChange: (_hasChanges: boolean) => void;
  refreshRepositories: () => Promise<void>;
  refreshProblems: () => Promise<void>;
}

// Helper function to determine the correct draft status based on new flow
const determineDraftStatus = (
  currentContent: string,
  committedContent: string,
  isManualSaving: boolean
): DraftStatus => {
  if (isManualSaving) return 'committing';

  // Both empty = no status shown
  if (!currentContent.trim() && !committedContent.trim()) return null;

  // Content matches committed = saved to server
  if (currentContent === committedContent) return 'committed';

  // Content differs from committed = draft (will be handled by autosave logic)
  return 'uncommitted';
};

export const MainContent: FC<MainContentProps> = ({
  selectedProblem,
  selectedAgent,
  selectedProblemData,
  onUncommittedChangesChange,
  refreshRepositories,
  refreshProblems,
}) => {
  const [comment, setComment] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>(null);
  const [isMarkdownRendered, setIsMarkdownRendered] = useState(false);
  const [isProblemStatementRendered, setIsProblemStatementRendered] =
    useState(false);
  const [isProblemStatementCollapsed, setIsProblemStatementCollapsed] =
    useState(false);
  const [groundTruthPatch, setGroundTruthPatch] = useState<PatchContent | null>(
    null
  );
  const [agentPatch, setAgentPatch] = useState<PatchContent | null>(null);
  const [currentLabel, setCurrentLabel] = useState<Label | null>(null);
  const [hideAuxiliaryFiles, setHideAuxiliaryFiles] = useState(true);

  // Autosave hook - only operates when we're in a draft state
  const { deleteDraft } = useAutosave({
    content: comment,
    problemId: selectedProblem,
    agentName: selectedAgent,
    isDraft:
      draftStatus === 'uncommitted' || draftStatus === 'autosave_triggered',
    onAutosaveStart: () => {
      // Autosave is actually starting - UI already shows "autosaving"
    },
    onAutosaveComplete: () => {
      // After autosave completes, return to regular "Draft" status
      setDraftStatus('uncommitted');
    },
  });

  // Load ground truth patch when problem changes
  useEffect(() => {
    setGroundTruthPatch(null);

    if (selectedProblem) {
      const loadGroundTruth = async () => {
        try {
          const patch = await apiClient.getGroundTruthPatch(selectedProblem);
          setGroundTruthPatch(patch);
        } catch (err) {
          console.error('Failed to load ground truth patch:', err);
          setGroundTruthPatch(null);
        }
      };
      loadGroundTruth();
    }
  }, [selectedProblem]);

  // Load agent patch when agent changes (problem is already selected)
  useEffect(() => {
    setAgentPatch(null);

    if (selectedAgent && selectedProblem) {
      const loadAgentPatch = async () => {
        try {
          const patch = await apiClient.getAgentPatch(
            selectedProblem,
            selectedAgent
          );
          setAgentPatch(patch);
        } catch (err) {
          console.error('Failed to load agent patch:', err);
          setAgentPatch(null);
        }
      };
      loadAgentPatch();
    }
  }, [selectedAgent]);

  // Load label and draft when agent changes (problem is already selected)
  useEffect(() => {
    // Immediately clear comment state when agent changes to prevent stale data
    setCurrentLabel(null);
    setComment('');
    setHasUnsavedChanges(false);
    setDraftStatus(null);

    if (selectedAgent && selectedProblem) {
      // Create cancellation flag to prevent stale updates
      let isCancelled = false;

      const loadLabelAndDraft = async () => {
        try {
          // Load both draft and committed label in parallel
          const [draft, labelResult] = await Promise.allSettled([
            draftManager.loadDraft(selectedProblem, selectedAgent),
            apiClient.getLabel(selectedProblem, selectedAgent),
          ]);

          if (isCancelled) return;

          // Get the committed label content (or null if failed/404)
          const label =
            labelResult.status === 'fulfilled' ? labelResult.value : null;
          const committedContent = label?.content || '';

          // Check if we have a draft and if it differs from committed content
          const draftData = draft.status === 'fulfilled' ? draft.value : null;
          const hasMeaningfulDraft =
            draftData && draftData.content !== committedContent;

          const contentToUse = hasMeaningfulDraft
            ? draftData.content
            : committedContent;

          setComment(contentToUse);
          setCurrentLabel(label);
          setHasUnsavedChanges(false);

          // Determine the correct status based on content
          const status = determineDraftStatus(
            contentToUse,
            committedContent,
            false
          );
          setDraftStatus(status);

          // Clean up any draft that matches committed content
          if (draftData && draftData.content === committedContent) {
            await draftManager.deleteDraft(selectedProblem, selectedAgent);
          }
        } catch (err) {
          // Only handle errors if request wasn't cancelled
          if (!isCancelled) {
            console.error('Failed to load label and draft:', err);
            setCurrentLabel(null);
            setComment('');
            setDraftStatus(null);
            setHasUnsavedChanges(false);
          }
        }
      };

      loadLabelAndDraft();

      // Cleanup function to cancel request when selections change
      return () => {
        isCancelled = true;
      };
    }
  }, [selectedAgent]);

  const handleCommentChange = useCallback(
    (value: string) => {
      // Guard: Only allow comment changes when both problem and agent are selected
      if (!selectedProblem || !selectedAgent) {
        console.warn(
          'Attempted to change comment without valid problem/agent selection'
        );
        return;
      }

      setComment(value);
      setHasUnsavedChanges(true);

      // Determine status when user types
      const committedContent = currentLabel?.content || '';

      // Check if both current and committed content are empty
      if (!value.trim() && !committedContent.trim()) {
        // Both empty = no status shown
        setDraftStatus(null);
        draftManager
          .deleteDraft(selectedProblem, selectedAgent)
          .catch((err) => {
            console.error('Failed to delete draft:', err);
          });
      } else if (value !== committedContent) {
        // Content differs from committed - this is a draft with autosave queued
        setDraftStatus('autosave_triggered');
        // This immediately shows "Draft (autosaving)" to indicate autosave is scheduled
      } else {
        // Content matches committed - determine appropriate status
        const newStatus = determineDraftStatus(
          value,
          committedContent,
          isSaving
        );
        setDraftStatus(newStatus);

        // Clean up any existing draft since content matches
        draftManager
          .deleteDraft(selectedProblem, selectedAgent)
          .catch((err) => {
            console.error('Failed to delete draft:', err);
          });
      }
    },
    [selectedProblem, selectedAgent, currentLabel, isSaving, draftStatus]
  );

  const handleCommit = useCallback(async () => {
    // Guard: Prevent commit if no valid selections or already committing
    if (!selectedProblem || !selectedAgent || isSaving) {
      console.warn(
        'Attempted to commit label without valid problem/agent selection or while committing'
      );
      return;
    }

    const content = comment.trim();
    setIsSaving(true);
    setDraftStatus('committing');

    try {
      if (content) {
        let savedLabel: Label;

        // Check if we have a draft - if so, commit it (file move operation)
        if (
          draftStatus === 'uncommitted' ||
          draftStatus === 'autosave_triggered'
        ) {
          // First save current content as draft, then commit
          await draftManager.saveDraft(selectedProblem, selectedAgent, content);
          savedLabel = await draftManager.commitDraft(
            selectedProblem,
            selectedAgent
          );
        } else {
          // No draft, save directly to server
          savedLabel = await apiClient.saveLabel(
            selectedProblem,
            selectedAgent,
            content
          );
        }

        setCurrentLabel(savedLabel);
        console.log(`Label committed successfully: ${content.length} chars`);
      } else {
        // Delete label if content is empty
        if (currentLabel) {
          await apiClient.deleteLabel(selectedProblem, selectedAgent);
          setCurrentLabel(null);
          console.log('Label deleted successfully');
        }

        // Also clean up any draft
        await deleteDraft();
      }

      setHasUnsavedChanges(false);

      // Determine the correct status after commit
      const finalContent = content || '';
      const status = determineDraftStatus(finalContent, finalContent, false);
      setDraftStatus(status);

      // Refresh both repository and problems statistics to reflect label changes
      await Promise.all([refreshRepositories(), refreshProblems()]);
    } catch (error) {
      console.error('Failed to commit label:', error);
      setDraftStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedProblem,
    selectedAgent,
    comment,
    currentLabel,
    isSaving,
    draftStatus,
    deleteDraft,
    refreshRepositories,
    refreshProblems,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!selectedProblem || !selectedAgent) return;

    // Delete the draft
    await deleteDraft();

    // Reset to committed content (or empty if no committed label)
    const committedContent = currentLabel?.content || '';
    setComment(committedContent);
    setHasUnsavedChanges(false);

    // Determine the correct status based on the committed content
    const status = determineDraftStatus(
      committedContent,
      committedContent,
      false
    );
    setDraftStatus(status);
  }, [selectedProblem, selectedAgent, deleteDraft, currentLabel]);

  const isDisabled = !selectedProblem || !selectedAgent;
  const canCommit =
    !isDisabled &&
    (hasUnsavedChanges || (!currentLabel && comment.trim().length > 0)) &&
    !isSaving;

  const hasUncommittedChanges =
    draftStatus === 'uncommitted' || draftStatus === 'autosave_triggered';

  // Notify parent component when uncommitted changes status changes
  useEffect(() => {
    onUncommittedChangesChange(hasUncommittedChanges);
  }, [hasUncommittedChanges, onUncommittedChangesChange]);

  // Generate base commit URL for clickable links
  const baseCommitUrl =
    selectedProblemData?.base_commit && selectedProblemData?.github_url
      ? `${selectedProblemData.github_url}/tree/${selectedProblemData.base_commit}`
      : undefined;

  // Render patch content with simple diff viewer
  const renderPatchContent = (
    patch: PatchContent | null,
    placeholder: string,
    isAgentPatch: boolean = false
  ) => {
    if (!patch) {
      return <div className="placeholder">{placeholder}</div>;
    }

    return (
      <SimpleDiffViewer
        diffText={patch.content}
        placeholder={placeholder}
        baseCommitUrl={baseCommitUrl}
        hideAuxiliaryFiles={isAgentPatch ? hideAuxiliaryFiles : false}
      />
    );
  };

  return (
    <main className="main-content">
      <div className="panel-container">
        {/* Problem Statement Panel - Full Width at Top */}
        <div
          className={`panel ${isProblemStatementCollapsed ? 'collapsed' : ''}`}
          id="problem-statement-panel"
        >
          <div className="panel-header">
            <h2>Problem Statement</h2>
            <div className="comment-actions">
              {!isProblemStatementCollapsed && (
                <button
                  onClick={() =>
                    setIsProblemStatementRendered(!isProblemStatementRendered)
                  }
                  disabled={!selectedProblemData?.problem_statement}
                >
                  {isProblemStatementRendered ? 'View Raw' : 'View Rendered'}
                </button>
              )}
              <button
                className="collapse-button"
                onClick={() =>
                  setIsProblemStatementCollapsed(!isProblemStatementCollapsed)
                }
              >
                {isProblemStatementCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>
          </div>
          {!isProblemStatementCollapsed && (
            <div className="panel-content">
              <div className="problem-statement-viewer">
                {selectedProblemData?.problem_statement ? (
                  <MarkdownEditor
                    value={selectedProblemData.problem_statement}
                    onChange={() => {}} // Read-only, no changes allowed
                    onSave={() => {}} // No save functionality needed
                    disabled={true} // Always disabled since it's read-only
                    isRendered={isProblemStatementRendered}
                  />
                ) : (
                  <div className="placeholder">
                    Select an issue to view problem statement
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Three Panels */}
        <div className="bottom-panels">
          {/* Ground Truth Panel */}
          <div className="panel" id="ground-truth-panel">
            <div className="panel-header">
              <h2>Ground Truth</h2>
            </div>
            <div className="panel-content">
              <div className="patch-viewer" id="ground-truth-content">
                {renderPatchContent(
                  groundTruthPatch,
                  'Select an issue to view ground truth patch'
                )}
              </div>
            </div>
          </div>

          {/* Agent Submission Panel */}
          <div className="panel" id="agent-submission-panel">
            <div className="panel-header">
              <h2>Agent Submission</h2>
              <div className="comment-actions">
                {agentPatch &&
                  (() => {
                    const filterResult = hasFilterableContent(
                      agentPatch.content
                    );

                    if (!filterResult.hasFilterable) return null;

                    const getBackgroundColor = () => {
                      if (!hideAuxiliaryFiles) return '#007acc';
                      return filterResult.hasRisky ? '#dc3545' : '#f3f3f3';
                    };

                    const getButtonText = () => {
                      if (!hideAuxiliaryFiles) return 'Hide auxiliary';
                      return filterResult.hasRisky
                        ? '⚠️ Show original ⚠️'
                        : 'Show original';
                    };

                    return (
                      <button
                        onClick={() =>
                          setHideAuxiliaryFiles(!hideAuxiliaryFiles)
                        }
                        style={{
                          background: getBackgroundColor(),
                          color:
                            hideAuxiliaryFiles && !filterResult.hasRisky
                              ? '#333'
                              : 'white',
                        }}
                      >
                        {getButtonText()}
                      </button>
                    );
                  })()}
              </div>
            </div>
            <div className="panel-content">
              <div className="patch-viewer" id="agent-submission-content">
                {renderPatchContent(
                  agentPatch,
                  'Select an issue and agent to view submission',
                  true
                )}
              </div>
            </div>
          </div>

          {/* User Comments Panel with Monaco Editor */}
          <div className="panel" id="user-comments-panel">
            <div className="panel-header">
              <h2>User Comments</h2>
              <div className="comment-actions">
                <button
                  onClick={() => setIsMarkdownRendered(!isMarkdownRendered)}
                  disabled={isDisabled || isSaving}
                  style={{
                    background: isMarkdownRendered ? '#007acc' : '#f3f3f3',
                    color: isMarkdownRendered ? 'white' : '#333',
                  }}
                >
                  {isMarkdownRendered ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>
            <div className="panel-content">
              {isDisabled ? (
                <div className="placeholder">
                  <br />
                  Select an issue and agent to add comments
                </div>
              ) : (
                <>
                  <div className="comment-editor">
                    <MarkdownEditor
                      value={comment}
                      onChange={handleCommentChange}
                      onSave={handleCommit}
                      disabled={isSaving}
                      isRendered={isMarkdownRendered}
                    />
                  </div>
                  <StatusBar
                    draftStatus={draftStatus}
                    canCommit={canCommit}
                    hasUncommittedChanges={hasUncommittedChanges}
                    isCommitting={isSaving}
                    onCommit={handleCommit}
                    onDiscard={handleDiscard}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
