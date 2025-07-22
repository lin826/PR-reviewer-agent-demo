// Shared types between frontend and backend

export interface Agent {
  name: string;
  display_name: string;
  total_problems: number;
  resolved_problems: number;
  success_rate: number;
}

export interface Repository {
  name: string;
  display_name: string;
  organization: string;
  repo_name: string;
  total_problems: number;
}

export interface ProblemSummary {
  problem_id: string;
  repo: string;
  issue_number: string;
  github_url: string;
  resolved_agents: string[];
  total_agents: number;
}

export interface Problem {
  problem_id: string;
  repo: string;
  base_commit: string;
  github_url: string;
  problem_statement: string;
  agent_submissions: AgentSubmission[];
}

export interface AgentSubmission {
  agent_name: string;
  patch_file: string;
  resolved: boolean;
}

export interface PatchContent {
  content: string;
  is_valid: boolean;
  changed_files: string[];
  stats: {
    file_count: number;
    additions: number;
    deletions: number;
  };
}

export interface PatchInfo {
  exists: boolean;
  file_path: string;
  file_count: number;
  additions: number;
  deletions: number;
}

export interface Label {
  problem_id: string;
  agent_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LabelStats {
  problem_id: string;
  total_agents: number;
  labeled_agents: number;
  unlabeled_agents: number;
}

export interface DataStats {
  agents: number;
  repositories: number;
  problems: number;
  total_submissions: number;
}

// API response wrapper types
export interface HealthResponse {
  status: string;
  data: DataStats;
}

export interface AdminRefreshResponse {
  message: string;
  scan_time: number;
  stats: DataStats;
}

export interface AdminStatusResponse {
  status: string;
  message: string;
  data_stats: DataStats;
}
