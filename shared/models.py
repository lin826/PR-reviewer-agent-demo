# Shared Pydantic models between backend components
from datetime import datetime

from pydantic import BaseModel, Field


class Agent(BaseModel):
    """Information about an available agent."""

    name: str = Field(
        ..., description="Internal agent name (e.g., '20250415_openhands')"
    )
    display_name: str = Field(..., description="Human-readable name for UI")
    total_problems: int = Field(..., description="Total number of problems attempted")
    resolved_problems: int = Field(..., description="Number of problems resolved")
    success_rate: float = Field(..., description="Success rate (resolved/total)")


class Repository(BaseModel):
    """Information about a repository."""

    name: str = Field(..., description="Repository identifier (e.g., 'django__django')")
    display_name: str = Field(..., description="Human-readable name")
    organization: str = Field(..., description="GitHub organization")
    repo_name: str = Field(..., description="Repository name")
    total_problems: int = Field(
        ..., description="Number of problems in this repository"
    )


class ProblemSummary(BaseModel):
    """Brief problem information for selectors."""

    problem_id: str = Field(..., description="Problem identifier")
    repo: str = Field(..., description="Repository name")
    issue_number: str = Field(..., description="Issue number")
    base_commit: str = Field("", description="Base commit SHA")
    github_url: str = Field(..., description="GitHub URL")
    resolved_agents: list[str] = Field(
        default_factory=list, description="List of agents that resolved this problem"
    )
    total_agents: int = Field(
        ..., description="Total agents that attempted this problem"
    )


class PatchStats(BaseModel):
    """Statistics about a patch."""

    file_count: int = Field(default=0, description="Number of files changed")
    additions: int = Field(default=0, description="Number of lines added")
    deletions: int = Field(default=0, description="Number of lines deleted")


class PatchContent(BaseModel):
    """Response model for patch content."""

    content: str = Field(..., description="Raw patch/diff content")
    is_valid: bool = Field(
        ..., description="Whether content appears to be valid patch format"
    )
    changed_files: list[str] = Field(
        default_factory=list, description="List of files modified in patch"
    )
    stats: PatchStats = Field(..., description="Patch statistics")


class PatchInfo(BaseModel):
    """Metadata about a patch without full content."""

    exists: bool = Field(..., description="Whether patch file exists")
    file_path: str = Field(..., description="Path to patch file")
    file_count: int = Field(default=0, description="Number of files changed")
    additions: int = Field(default=0, description="Number of lines added")
    deletions: int = Field(default=0, description="Number of lines deleted")


class Label(BaseModel):
    """User label/comment for a specific problem-agent combination."""

    problem_id: str = Field(..., description="Problem identifier")
    agent_name: str = Field(..., description="Agent name")
    content: str = Field(..., description="Markdown content of the label")
    created_at: datetime = Field(..., description="Timestamp when label was created")
    updated_at: datetime = Field(
        ..., description="Timestamp when label was last updated"
    )


class LabelStats(BaseModel):
    """Statistics about labeling progress for a problem."""

    problem_id: str = Field(..., description="Problem identifier")
    total_agents: int = Field(
        ..., description="Total number of agents for this problem"
    )
    labeled_agents: int = Field(..., description="Number of agents with labels")
    unlabeled_agents: int = Field(..., description="Number of agents without labels")


class DataStats(BaseModel):
    """Overall dataset statistics."""

    agents: int = Field(..., description="Number of agents")
    repositories: int = Field(..., description="Number of repositories")
    problems: int = Field(..., description="Number of problems")
    total_submissions: int = Field(..., description="Total number of submissions")
