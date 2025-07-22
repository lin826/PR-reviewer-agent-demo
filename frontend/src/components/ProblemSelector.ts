import { apiClient } from '../services/api.js';
import type { ProblemSummary } from '../types/index.js';

export class ProblemSelector {
  private element: HTMLSelectElement;
  private problems: ProblemSummary[] = [];
  private currentRepo: string | null = null;
  private onChangeCallback?: (_problemId: string | null) => void;

  constructor(element: HTMLSelectElement) {
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('change', () => {
      const selectedProblem = this.element.value || null;
      console.log('Problem selected:', selectedProblem);

      if (this.onChangeCallback) {
        this.onChangeCallback(selectedProblem);
      }
    });
  }

  public onChange(callback: (_problemId: string | null) => void): void {
    this.onChangeCallback = callback;
  }

  public async loadProblems(repoName: string | null): Promise<void> {
    this.currentRepo = repoName;

    if (!repoName) {
      this.clearProblems();
      return;
    }

    try {
      console.log(`Loading problems for repository: ${repoName}...`);
      this.setLoading(true);

      this.problems = await apiClient.getProblems(repoName);
      console.log(
        `Loaded ${this.problems.length} problems for ${repoName}:`,
        this.problems.slice(0, 5).map((p) => p.problem_id)
      );

      this.populateDropdown();
      this.setLoading(false);
    } catch (error) {
      console.error(`Failed to load problems for ${repoName}:`, error);
      this.setError();
    }
  }

  private populateDropdown(): void {
    // Clear existing options except the placeholder
    this.element.innerHTML = '<option value="">Select Problem...</option>';

    if (this.problems.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No problems found for this repository';
      option.disabled = true;
      this.element.appendChild(option);
      return;
    }

    // Sort problems by issue number (numeric)
    const sortedProblems = [...this.problems].sort((a, b) => {
      const aNum = parseInt(a.issue_number, 10);
      const bNum = parseInt(b.issue_number, 10);
      return aNum - bNum;
    });

    // Add problem options
    sortedProblems.forEach((problem) => {
      const option = document.createElement('option');
      option.value = problem.problem_id;

      // Show problem ID, issue number, and resolution status
      const resolvedCount = problem.resolved_agents.length;
      const totalCount = problem.total_agents;
      const statusText =
        resolvedCount > 0
          ? `${resolvedCount}/${totalCount} resolved`
          : `0/${totalCount} resolved`;

      option.textContent = `${problem.problem_id} (${statusText})`;
      this.element.appendChild(option);
    });

    console.log(
      `Populated problem dropdown with ${sortedProblems.length} options`
    );
  }

  private clearProblems(): void {
    this.problems = [];
    this.element.innerHTML =
      '<option value="">Select a repository first...</option>';
    this.element.disabled = true;
  }

  private setLoading(loading: boolean): void {
    this.element.disabled = loading;

    if (loading) {
      this.element.innerHTML = '<option value="">Loading problems...</option>';
    }
  }

  private setError(): void {
    this.element.disabled = true;
    this.element.innerHTML =
      '<option value="">Failed to load problems</option>';
  }

  public getSelectedProblem(): string | null {
    return this.element.value || null;
  }

  public setSelectedProblem(problemId: string | null): void {
    this.element.value = problemId || '';

    // Trigger change event to notify listeners
    const event = new Event('change');
    this.element.dispatchEvent(event);
  }

  public getProblemById(id: string): ProblemSummary | undefined {
    return this.problems.find((problem) => problem.problem_id === id);
  }

  public enable(): void {
    if (this.currentRepo) {
      this.element.disabled = false;
    }
  }

  public disable(): void {
    this.element.disabled = true;
  }

  public getCurrentRepository(): string | null {
    return this.currentRepo;
  }

  public getProblemsCount(): number {
    return this.problems.length;
  }
}
