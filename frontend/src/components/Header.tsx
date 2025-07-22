import React from 'react';
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
  onAgentChange: (_agentName: string | null) => void;
  onRepositoryChange: (_repositoryName: string | null) => void;
  onProblemChange: (_problemId: string | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  agents,
  repositories,
  problems,
  selectedAgent,
  selectedRepository,
  selectedProblem,
  selectedProblemData,
  onAgentChange,
  onRepositoryChange,
  onProblemChange,
}) => {
  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onAgentChange(value);
  };

  const handleRepositoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    onRepositoryChange(value);
  };

  const handleProblemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
            value={selectedAgent || ''}
            onChange={handleAgentChange}
            disabled={agents.length === 0}
          >
            <option value="">Select Agent...</option>
            {agents.map((agent) => (
              <option key={agent.name} value={agent.name}>
                {agent.display_name} ({agent.resolved_problems}/
                {agent.total_problems})
              </option>
            ))}
          </select>

          <select
            value={selectedRepository || ''}
            onChange={handleRepositoryChange}
            disabled={repositories.length === 0}
          >
            <option value="">Select Repository...</option>
            {repositories.map((repo) => (
              <option key={repo.name} value={repo.name}>
                {repo.display_name} ({repo.total_problems} problems)
              </option>
            ))}
          </select>

          <select
            value={selectedProblem || ''}
            onChange={handleProblemChange}
            disabled={problems.length === 0}
          >
            <option value="">Select Problem...</option>
            {problems.map((problem) => {
              // Show emoji status when an agent is selected
              let statusDisplay: string;
              if (selectedAgent) {
                const isResolved =
                  problem.resolved_agents.includes(selectedAgent);
                statusDisplay = isResolved ? '✅' : '❌';
              } else {
                statusDisplay = `(${problem.resolved_agents.length}/${problem.total_agents} agents)`;
              }

              return (
                <option key={problem.problem_id} value={problem.problem_id}>
                  #{problem.issue_number} {statusDisplay}
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
