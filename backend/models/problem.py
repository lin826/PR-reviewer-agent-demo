from pydantic import BaseModel, Field


class AgentResults(BaseModel):
    """Structure of results.json file for each agent."""

    resolved: list[str] = Field(
        default_factory=list, description="List of resolved problem IDs"
    )
    no_generation: list[str] = Field(
        default_factory=list, description="Problems with no patch generation"
    )
    no_logs: list[str] = Field(
        default_factory=list, description="Problems with missing logs"
    )


class Problem(BaseModel):
    problem_id: str = Field(
        ..., description="Unique problem identifier (e.g., 'django__django-10097')"
    )
    repo: str = Field(..., description="Repository name (e.g., 'django__django')")
    issue_number: str = Field(..., description="Issue number (e.g., '10097')")
    base_commit: str = Field("", description="Base commit SHA")
    github_url: str = Field("", description="GitHub URL to the issue")
    problem_statement: str = Field("", description="Problem description/statement")
    ground_truth_patch: str | None = Field(
        None, description="Ground truth patch content"
    )


class AgentSubmission(BaseModel):
    agent_name: str = Field(
        ..., description="Agent name (e.g., '20250316_augment_agent_v0')"
    )
    patch_file: str = Field(..., description="Path to patch file")
    resolved: bool = Field(False, description="Whether agent marked this as resolved")
    patch_content: str | None = Field(
        None, description="Patch content or None if no submission"
    )


class ProblemWithSubmissions(BaseModel):
    problem: Problem
    agents: dict[str, AgentSubmission] = Field(
        default_factory=dict, description="Agent submissions keyed by agent name"
    )
