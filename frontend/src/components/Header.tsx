import type { FC, ChangeEvent } from 'react';
import type {
  Agent,
  Repository,
  ProblemSummary,
  Problem,
} from '../types/index';

interface HeaderProps {
  agents: Agent[];
  repositories: Repository[];
  problems: ProblemSummary[];
  selectedAgent: string | null;
  selectedRepository: string | null;
  selectedProblem: string | null;
  selectedProblemData: Problem | null;
  hasUncommittedChanges: boolean;
  onAgentChange: (_agentName: string | null) => void;
  onRepositoryChange: (_repositoryName: string | null) => void;
  onProblemChange: (_problemId: string | null) => void;
}

export const Header: FC<HeaderProps> = ({
  agents,
  repositories,
  problems,
  selectedAgent,
  selectedRepository,
  selectedProblem,
  selectedProblemData,
  hasUncommittedChanges,
  onAgentChange,
  onRepositoryChange,
  onProblemChange,
}) => {
  const handleAgentChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onAgentChange(value);
  };

  const handleRepositoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onRepositoryChange(value);
  };

  const handleProblemChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onProblemChange(value);
  };

  // Generate GitHub links
  const githubUrl = selectedProblemData?.github_url || '#';
  const baseCommitUrl =
    selectedProblemData?.base_commit && selectedProblemData?.github_url
      ? (() => {
          const repoMatch = selectedProblemData.github_url.match(
            /github\.com\/([^/]+\/[^/]+)/
          );
          return repoMatch
            ? `https://github.com/${repoMatch[1]}/tree/${selectedProblemData.base_commit}`
            : '#';
        })()
      : '#';

  const hasValidGithubUrl = githubUrl !== '#';
  const hasValidBaseCommitUrl = baseCommitUrl !== '#';

  return (
    <header className="header">
      <div className="header-content">
        <h1>SWE Quality Viewer</h1>
        <div className="selectors">
          <select
            value={selectedRepository || ''}
            onChange={handleRepositoryChange}
            disabled={repositories.length === 0 || hasUncommittedChanges}
            title={
              hasUncommittedChanges
                ? 'Commit or discard changes to navigate'
                : ''
            }
          >
            <option value="">Select Repository...</option>
            {repositories.map((repo) => (
              <option key={repo.name} value={repo.name}>
                {repo.display_name} ({repo.labeled_issues}/{repo.total_problems}{' '}
                labeled)
              </option>
            ))}
          </select>

          <select
            value={selectedProblem || ''}
            onChange={handleProblemChange}
            disabled={problems.length === 0 || hasUncommittedChanges}
            title={
              hasUncommittedChanges
                ? 'Commit or discard changes to navigate'
                : ''
            }
          >
            <option value="">Select Issue...</option>
            {problems.map((problem) => {
              const statusDisplay = `(${problem.labeled_resolved_agents}/${problem.total_resolved_agents} labeled)`;
              return (
                <option key={problem.problem_id} value={problem.problem_id}>
                  #{problem.issue_number} {statusDisplay}
                </option>
              );
            })}
          </select>

          <select
            value={selectedAgent || ''}
            onChange={handleAgentChange}
            disabled={
              agents.length === 0 || !selectedProblem || hasUncommittedChanges
            }
            title={
              hasUncommittedChanges
                ? 'Commit or discard changes to navigate'
                : ''
            }
          >
            <option value="">Select Agent...</option>
            {agents.map((agent) => {
              // Show emoji status based on whether this agent resolved the selected problem
              let statusDisplay: string = '';
              if (selectedProblem && problems.length > 0) {
                const selectedProblemData = problems.find(
                  (p) => p.problem_id === selectedProblem
                );
                if (selectedProblemData) {
                  const isResolved =
                    selectedProblemData.resolved_agents.includes(agent.name);
                  statusDisplay = isResolved ? ' ✅' : ' ❌';
                }
              }
              return (
                <option key={agent.name} value={agent.name}>
                  {agent.display_name}
                  {statusDisplay}
                </option>
              );
            })}
          </select>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              opacity: hasValidGithubUrl ? 1 : 0.5,
              pointerEvents: hasValidGithubUrl ? 'auto' : 'none',
            }}
          >
            View PR on GitHub
          </a>

          <a
            href={baseCommitUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              opacity: hasValidBaseCommitUrl ? 1 : 0.5,
              pointerEvents: hasValidBaseCommitUrl ? 'auto' : 'none',
            }}
          >
            View Base Commit
          </a>
        </div>
      </div>
    </header>
  );
};
