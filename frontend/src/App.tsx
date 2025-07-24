import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MainContent } from './components/MainContent';
import { apiClient } from './services/api';
import type { Agent, Repository, ProblemSummary, Problem } from './types/index';
import './styles/main.css';

function App(): React.ReactElement {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(
    null
  );
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [selectedProblemData, setSelectedProblemData] =
    useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [agentsData, repositoriesData] = await Promise.all([
          apiClient.getAgents(),
          apiClient.getRepositories(),
        ]);
        setAgents(agentsData);
        setRepositories(repositoriesData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load initial data'
        );
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load problems when repository changes
  useEffect(() => {
    if (selectedRepository) {
      const loadProblems = async () => {
        try {
          const problemsData = await apiClient.getProblems(selectedRepository);
          setProblems(problemsData);
          setSelectedProblem(null); // Clear problem selection
          setSelectedProblemData(null);
          setSelectedAgent(null); // Clear agent selection when repository changes
        } catch (err) {
          console.error('Failed to load problems:', err);
          setProblems([]);
        }
      };
      loadProblems();
    } else {
      setProblems([]);
      setSelectedProblem(null);
      setSelectedProblemData(null);
      setSelectedAgent(null); // Clear agent selection when no repository
    }
  }, [selectedRepository]);

  // Load problem data when problem changes
  useEffect(() => {
    if (selectedProblem) {
      const loadProblemData = async () => {
        try {
          const problemData = await apiClient.getProblem(selectedProblem);
          setSelectedProblemData(problemData);
        } catch (err) {
          console.error('Failed to load problem data:', err);
          setSelectedProblemData(null);
        }
      };
      loadProblemData();
      setSelectedAgent(null); // Clear agent selection when problem changes
    } else {
      setSelectedProblemData(null);
      setSelectedAgent(null); // Clear agent selection when no problem
    }
  }, [selectedProblem]);

  const handleAgentChange = (agentName: string | null) => {
    if (hasUncommittedChanges) {
      console.warn('Cannot change agent: uncommitted changes exist');
      return;
    }
    setSelectedAgent(agentName);
  };

  const handleRepositoryChange = (repositoryName: string | null) => {
    if (hasUncommittedChanges) {
      console.warn('Cannot change repository: uncommitted changes exist');
      return;
    }
    setSelectedRepository(repositoryName);
  };

  const handleProblemChange = (problemId: string | null) => {
    if (hasUncommittedChanges) {
      console.warn('Cannot change problem: uncommitted changes exist');
      return;
    }
    setSelectedProblem(problemId);
  };

  const refreshRepositories = async () => {
    try {
      const repositoriesData = await apiClient.getRepositories();
      setRepositories(repositoriesData);
    } catch (err) {
      console.error('Failed to refresh repositories:', err);
    }
  };

  const refreshProblems = async () => {
    if (selectedRepository) {
      try {
        const problemsData = await apiClient.getProblems(selectedRepository);
        setProblems(problemsData);
      } catch (err) {
        console.error('Failed to refresh problems:', err);
      }
    }
  };

  if (loading) {
    return (
      <div id="app">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="app">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'red',
          }}
        >
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      <Header
        agents={agents}
        repositories={repositories}
        problems={problems}
        selectedAgent={selectedAgent}
        selectedRepository={selectedRepository}
        selectedProblem={selectedProblem}
        selectedProblemData={selectedProblemData}
        hasUncommittedChanges={hasUncommittedChanges}
        onAgentChange={handleAgentChange}
        onRepositoryChange={handleRepositoryChange}
        onProblemChange={handleProblemChange}
      />
      <MainContent
        selectedProblem={selectedProblem}
        selectedAgent={selectedAgent}
        selectedProblemData={selectedProblemData}
        onUncommittedChangesChange={setHasUncommittedChanges}
        refreshRepositories={refreshRepositories}
        refreshProblems={refreshProblems}
      />
    </div>
  );
}

export default App;
