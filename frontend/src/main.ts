// Main application entry point
import { AgentSelector } from './components/AgentSelector.js';
import { RepositorySelector } from './components/RepositorySelector.js';
import { ProblemSelector } from './components/ProblemSelector.js';
import { PatchViewer } from './components/PatchViewer.js';
import { LabelEditor } from './components/LabelEditor.js';

console.log('SWE Quality Frontend initializing...');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing app...');

  // Get selector elements
  const agentElement = document.getElementById(
    'agent-selector'
  ) as HTMLSelectElement;
  const repositoryElement = document.getElementById(
    'repository-selector'
  ) as HTMLSelectElement;
  const problemElement = document.getElementById(
    'problem-selector'
  ) as HTMLSelectElement;
  const githubLink = document.getElementById(
    'github-link'
  ) as HTMLAnchorElement;

  // Get patch viewer elements
  const groundTruthContent = document.getElementById(
    'ground-truth-content'
  ) as HTMLElement;
  const agentSubmissionContent = document.getElementById(
    'agent-submission-content'
  ) as HTMLElement;

  // Get label editor elements
  const commentTextarea = document.getElementById(
    'comment-textarea'
  ) as HTMLTextAreaElement;
  const saveButton = document.getElementById(
    'save-comment'
  ) as HTMLButtonElement;

  if (
    !agentElement ||
    !repositoryElement ||
    !problemElement ||
    !githubLink ||
    !groundTruthContent ||
    !agentSubmissionContent ||
    !commentTextarea ||
    !saveButton
  ) {
    console.error('Required elements not found');
    return;
  }

  // Initialize components
  const agentSelector = new AgentSelector(agentElement);
  const repositorySelector = new RepositorySelector(repositoryElement);
  const problemSelector = new ProblemSelector(problemElement);
  const patchViewer = new PatchViewer(
    groundTruthContent,
    agentSubmissionContent
  );
  const labelEditor = new LabelEditor(commentTextarea, saveButton);

  // Set up selection handlers
  agentSelector.onChange((agentName) => {
    console.log('App: Agent selection changed to:', agentName);
    updateViewerContent();
    updateLabelEditor();
  });

  repositorySelector.onChange(async (repoName) => {
    console.log('App: Repository selection changed to:', repoName);

    // Load problems for selected repository
    await problemSelector.loadProblems(repoName);

    // Clear problem selection when repository changes
    problemSelector.setSelectedProblem(null);

    // Hide GitHub link until problem is selected
    githubLink.style.display = 'none';

    updateViewerContent();
    updateLabelEditor();
  });

  problemSelector.onChange((problemId) => {
    console.log('App: Problem selection changed to:', problemId);

    // Update GitHub link
    if (problemId) {
      const problem = problemSelector.getProblemById(problemId);
      if (problem) {
        githubLink.href = problem.github_url;
        githubLink.style.display = 'inline-block';
      }
    } else {
      githubLink.style.display = 'none';
    }

    updateViewerContent();
    updateLabelEditor();
  });

  // Update viewer content based on current selections
  async function updateViewerContent(): Promise<void> {
    const selectedAgent = agentSelector.getSelectedAgent();
    const selectedRepo = repositorySelector.getSelectedRepository();
    const selectedProblem = problemSelector.getSelectedProblem();

    console.log('Current selections:', {
      agent: selectedAgent,
      repository: selectedRepo,
      problem: selectedProblem,
    });

    // Load patches based on current selections
    await patchViewer.loadPatches(selectedProblem, selectedAgent);
  }

  // Update label editor based on current selections
  async function updateLabelEditor(): Promise<void> {
    const selectedAgent = agentSelector.getSelectedAgent();
    const selectedProblem = problemSelector.getSelectedProblem();

    console.log('Label editor: Loading label for', {
      problem: selectedProblem,
      agent: selectedAgent,
    });

    // Load label based on current selections
    await labelEditor.loadLabel(selectedProblem, selectedAgent);
  }

  // Load initial data
  try {
    console.log('Loading agents and repositories...');

    // Load both in parallel
    await Promise.all([
      agentSelector.loadAgents(),
      repositorySelector.loadRepositories(),
    ]);

    // Initialize placeholder messages
    await updateViewerContent();
    await updateLabelEditor();

    console.log('App initialization complete');
  } catch (error) {
    console.error('Failed to initialize app:', error);

    // Show error in placeholder
    const placeholder = document.querySelector(
      '#ground-truth-content .placeholder'
    );
    if (placeholder) {
      placeholder.textContent =
        'Failed to connect to backend. Please ensure the backend is running.';
    }
  }
});
