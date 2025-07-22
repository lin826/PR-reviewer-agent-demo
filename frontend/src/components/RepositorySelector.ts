import { apiClient } from '../services/api.js';
import type { Repository } from '../types/index.js';

export class RepositorySelector {
  private element: HTMLSelectElement;
  private repositories: Repository[] = [];
  private onChangeCallback?: (_repoName: string | null) => void;

  constructor(element: HTMLSelectElement) {
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('change', () => {
      const selectedRepo = this.element.value || null;
      console.log('Repository selected:', selectedRepo);

      if (this.onChangeCallback) {
        this.onChangeCallback(selectedRepo);
      }
    });
  }

  public onChange(callback: (_repoName: string | null) => void): void {
    this.onChangeCallback = callback;
  }

  public async loadRepositories(): Promise<void> {
    try {
      console.log('Loading repositories...');
      this.setLoading(true);

      this.repositories = await apiClient.getRepositories();
      console.log(
        `Loaded ${this.repositories.length} repositories:`,
        this.repositories.map((r) => r.name)
      );

      this.populateDropdown();
      this.setLoading(false);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      this.setError();
    }
  }

  private populateDropdown(): void {
    // Clear existing options except the placeholder
    this.element.innerHTML = '<option value="">Select Repository...</option>';

    // Sort repositories by organization, then by repo name
    const sortedRepos = [...this.repositories].sort((a, b) => {
      if (a.organization !== b.organization) {
        return a.organization.localeCompare(b.organization);
      }
      return a.repo_name.localeCompare(b.repo_name);
    });

    // Add repository options
    sortedRepos.forEach((repo) => {
      const option = document.createElement('option');
      option.value = repo.name;
      option.textContent = `${repo.display_name} (${repo.total_problems} problems)`;
      this.element.appendChild(option);
    });

    console.log(
      `Populated repository dropdown with ${sortedRepos.length} options`
    );
  }

  private setLoading(loading: boolean): void {
    this.element.disabled = loading;

    if (loading) {
      this.element.innerHTML =
        '<option value="">Loading repositories...</option>';
    }
  }

  private setError(): void {
    this.element.disabled = true;
    this.element.innerHTML =
      '<option value="">Failed to load repositories</option>';
  }

  public getSelectedRepository(): string | null {
    return this.element.value || null;
  }

  public setSelectedRepository(repoName: string | null): void {
    this.element.value = repoName || '';

    // Trigger change event to notify listeners
    const event = new Event('change');
    this.element.dispatchEvent(event);
  }

  public getRepositoryByName(name: string): Repository | undefined {
    return this.repositories.find((repo) => repo.name === name);
  }

  public enable(): void {
    this.element.disabled = false;
  }

  public disable(): void {
    this.element.disabled = true;
  }
}
