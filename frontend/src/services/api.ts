import type {
  Agent,
  Repository,
  ProblemSummary,
  Problem,
  PatchContent,
  PatchInfo,
  Label,
  LabelStats,
  HealthResponse,
  AdminRefreshResponse,
  AdminStatusResponse,
} from '../types/index.js';

const BASE_URL = 'http://localhost:8000';

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error response: ${errorText}`);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);

      // Check if it's a network error
      if (
        error instanceof TypeError &&
        error.message.includes('Failed to fetch')
      ) {
        throw new Error(
          `Network error: Cannot connect to backend at ${this.baseUrl}. Please ensure the backend is running.`
        );
      }

      throw error;
    }
  }

  // Selector endpoints
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/selectors/agents');
  }

  async getRepositories(): Promise<Repository[]> {
    return this.request<Repository[]>('/selectors/repositories');
  }

  async getProblems(repo?: string): Promise<ProblemSummary[]> {
    const params = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    return this.request<ProblemSummary[]>(`/selectors/problems${params}`);
  }

  // Problem endpoints
  async getProblem(problemId: string): Promise<Problem> {
    return this.request<Problem>(`/problems/${problemId}`);
  }

  // Patch endpoints
  async getGroundTruthPatch(problemId: string): Promise<PatchContent> {
    return this.request<PatchContent>(
      `/patches/problems/${problemId}/ground_truth`
    );
  }

  async getAgentPatch(
    problemId: string,
    agentName: string
  ): Promise<PatchContent> {
    return this.request<PatchContent>(
      `/patches/problems/${problemId}/agents/${agentName}`
    );
  }

  async getAgentPatchInfo(
    problemId: string,
    agentName: string
  ): Promise<PatchInfo> {
    return this.request<PatchInfo>(
      `/patches/problems/${problemId}/agents/${agentName}/info`
    );
  }

  // Label endpoints
  async getLabel(problemId: string, agentName: string): Promise<Label> {
    return this.request<Label>(`/labels/${problemId}/${agentName}`);
  }

  async saveLabel(
    problemId: string,
    agentName: string,
    content: string
  ): Promise<Label> {
    return this.request<Label>(`/labels/${problemId}/${agentName}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteLabel(
    problemId: string,
    agentName: string
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/labels/${problemId}/${agentName}`,
      {
        method: 'DELETE',
      }
    );
  }

  async getLabelStats(problemId: string): Promise<LabelStats> {
    return this.request<LabelStats>(`/labels/stats/${problemId}`);
  }

  // Utility endpoints
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async refreshData(): Promise<AdminRefreshResponse> {
    return this.request<AdminRefreshResponse>('/admin/refresh', {
      method: 'POST',
    });
  }

  async getStatus(): Promise<AdminStatusResponse> {
    return this.request<AdminStatusResponse>('/admin/status');
  }
}

// Export singleton instance
export const apiClient = new APIClient();
