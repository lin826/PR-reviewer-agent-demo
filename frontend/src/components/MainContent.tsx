import React, { useState, useCallback, useEffect } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { SimpleDiffViewer } from './SimpleDiffViewer';
import { apiClient } from '../services/api';
import type { Problem, PatchContent, Label } from '../types/index';

interface MainContentProps {
  selectedProblem: string | null;
  selectedAgent: string | null;
  selectedProblemData: Problem | null;
}

export const MainContent: React.FC<MainContentProps> = ({
  selectedProblem,
  selectedAgent,
  selectedProblemData,
}) => {
  const [comment, setComment] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Load ground truth patch when problem changes
  useEffect(() => {
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
    } else {
      setGroundTruthPatch(null);
    }
  }, [selectedProblem]);

  // Load agent patch when problem and agent change
  useEffect(() => {
    if (selectedProblem && selectedAgent) {
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
    } else {
      setAgentPatch(null);
    }
  }, [selectedProblem, selectedAgent]);

  // Load label when problem and agent change
  useEffect(() => {
    if (selectedProblem && selectedAgent) {
      const loadLabel = async () => {
        try {
          const label = await apiClient.getLabel(
            selectedProblem,
            selectedAgent
          );
          setCurrentLabel(label);
          setComment(label?.content || '');
          setHasUnsavedChanges(false);
        } catch (err) {
          // 404 means no label exists yet - that's fine
          if (err instanceof Error && err.message.includes('404')) {
            setCurrentLabel(null);
            setComment('');
            setHasUnsavedChanges(false);
          } else {
            console.error('Failed to load label:', err);
          }
        }
      };
      loadLabel();
    } else {
      setCurrentLabel(null);
      setComment('');
      setHasUnsavedChanges(false);
    }
  }, [selectedProblem, selectedAgent]);

  const handleCommentChange = useCallback((value: string) => {
    setComment(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedProblem || !selectedAgent || isSaving) return;

    const content = comment.trim();
    setIsSaving(true);

    try {
      if (content) {
        // Save label
        const savedLabel = await apiClient.saveLabel(
          selectedProblem,
          selectedAgent,
          content
        );
        setCurrentLabel(savedLabel);
        console.log(`Label saved successfully: ${content.length} chars`);
      } else {
        // Delete label if content is empty
        if (currentLabel) {
          await apiClient.deleteLabel(selectedProblem, selectedAgent);
          setCurrentLabel(null);
          console.log('Label deleted successfully');
        }
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save label:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedProblem, selectedAgent, comment, currentLabel, isSaving]);

  const isDisabled = !selectedProblem || !selectedAgent;
  const canSave =
    !isDisabled &&
    (hasUnsavedChanges || (!currentLabel && comment.trim().length > 0)) &&
    !isSaving;

  // Generate base commit URL for clickable links
  const baseCommitUrl =
    selectedProblemData?.base_commit && selectedProblemData?.github_url
      ? (() => {
          const repoMatch = selectedProblemData.github_url.match(
            /github\.com\/([^/]+\/[^/]+)/
          );
          return repoMatch
            ? `https://github.com/${repoMatch[1]}/tree/${selectedProblemData.base_commit}`
            : undefined;
        })()
      : undefined;

  // Render patch content with simple diff viewer
  const renderPatchContent = (
    patch: PatchContent | null,
    placeholder: string
  ) => {
    if (!patch) {
      return <div className="placeholder">{placeholder}</div>;
    }

    return (
      <SimpleDiffViewer
        diffText={patch.content}
        placeholder={placeholder}
        baseCommitUrl={baseCommitUrl}
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
                    Select a problem to view problem statement
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
                  'Select a problem to view ground truth patch'
                )}
              </div>
            </div>
          </div>

          {/* Agent Submission Panel */}
          <div className="panel" id="agent-submission-panel">
            <div className="panel-header">
              <h2>Agent Submission</h2>
            </div>
            <div className="panel-content">
              <div className="patch-viewer" id="agent-submission-content">
                {renderPatchContent(
                  agentPatch,
                  'Select an agent and problem to view submission'
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
                    marginRight: '8px',
                  }}
                >
                  {isMarkdownRendered ? 'Edit' : 'Preview'}
                </button>
                <button
                  id="save-comment"
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="panel-content">
              <div className="comment-editor">
                <MarkdownEditor
                  value={comment}
                  onChange={handleCommentChange}
                  onSave={handleSave}
                  disabled={isDisabled || isSaving}
                  isRendered={isMarkdownRendered}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
