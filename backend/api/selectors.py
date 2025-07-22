from fastapi import APIRouter, Query

from backend.models import Agent, ProblemSummary, Repository
from backend.services import scanner

router = APIRouter(prefix="/selectors", tags=["selectors"])

# FastAPI Query parameter defaults are evaluated at import time, which is safe
# pyright: reportCallInDefaultInitializer=false


@router.get("/agents", response_model=list[Agent])
def list_agents() -> list[Agent]:
    """
    Get all available agents with statistics.

    Used to populate the agent selector dropdown in the frontend.
    Returns agents with success rates and problem counts.
    """
    agents = scanner.get_agents()
    agent_list: list[Agent] = []

    for agent_name in agents:
        # Get all submissions for this agent
        all_problems = scanner.get_problems()
        total_problems = len(all_problems)

        # Count resolved problems
        resolved_count = 0
        for problem in all_problems:
            submission = scanner.get_agent_submission(agent_name, problem.problem_id)
            if submission and submission.resolved:
                resolved_count += 1

        # Calculate success rate
        success_rate = resolved_count / total_problems if total_problems > 0 else 0.0

        # Generate display name from internal name
        display_name = _format_agent_display_name(agent_name)

        agent_list.append(
            Agent(
                name=agent_name,
                display_name=display_name,
                total_problems=total_problems,
                resolved_problems=resolved_count,
                success_rate=success_rate,
            )
        )

    # Sort by success rate descending, then by name
    return sorted(agent_list, key=lambda a: (-a.success_rate, a.display_name))


@router.get("/repositories", response_model=list[Repository])
def list_repositories() -> list[Repository]:
    """
    Get all available repositories with statistics.

    Used to populate the repository selector dropdown in the frontend.
    """
    repos = scanner.get_repos()
    repo_list: list[Repository] = []

    for repo_name in repos:
        # Get problems for this repository
        problems = scanner.get_problems(repo=repo_name)

        # Parse organization and repo name
        if "__" in repo_name:
            org, repo = repo_name.split("__", 1)
        else:
            org, repo = "unknown", repo_name

        # Generate display name
        display_name = f"{org}/{repo}"

        repo_list.append(
            Repository(
                name=repo_name,
                display_name=display_name,
                organization=org,
                repo_name=repo,
                total_problems=len(problems),
            )
        )

    # Sort by number of problems descending, then by name
    return sorted(repo_list, key=lambda r: (-r.total_problems, r.display_name))


@router.get("/problems", response_model=list[ProblemSummary])
def list_problems_for_selector(
    repo: str | None = Query(default=None, description="Filter by repository"),
    limit: int = Query(
        default=50, ge=1, le=500, description="Maximum number of results"
    ),
) -> list[ProblemSummary]:
    """
    Get problems for the problem selector dropdown.

    Returns abbreviated problem info suitable for selection UI.
    Can be filtered by repository.
    """
    problems = scanner.get_problems(repo=repo)[:limit]
    problem_summaries: list[ProblemSummary] = []

    for problem in problems:
        # Get all submissions for this problem
        submissions = scanner.get_all_agent_submissions(problem.problem_id)

        # Find resolved agents
        resolved_agents = [
            agent_name
            for agent_name, submission in submissions.items()
            if submission.resolved
        ]

        problem_summaries.append(
            ProblemSummary(
                problem_id=problem.problem_id,
                repo=problem.repo,
                issue_number=problem.issue_number,
                github_url=problem.github_url,
                resolved_agents=resolved_agents,
                total_agents=len(submissions),
            )
        )

    return problem_summaries


@router.get("/stats")
def get_overall_stats() -> dict[str, int | float]:
    """
    Get overall statistics for the dataset.

    Useful for dashboard summary information.
    """
    stats = scanner.get_stats()

    # Calculate additional derived stats
    problems = scanner.get_problems()
    total_attempts = stats["total_submissions"]

    # Count resolved attempts
    resolved_attempts = 0
    for problem in problems:
        submissions = scanner.get_all_agent_submissions(problem.problem_id)
        resolved_attempts += sum(1 for sub in submissions.values() if sub.resolved)

    # Calculate overall success rate
    overall_success_rate = (
        resolved_attempts / total_attempts if total_attempts > 0 else 0.0
    )

    return {
        "total_agents": stats["agents"],
        "total_repositories": stats["repositories"],
        "total_problems": stats["problems"],
        "total_attempts": total_attempts,
        "resolved_attempts": resolved_attempts,
        "overall_success_rate": round(overall_success_rate, 3),
    }


def _format_agent_display_name(agent_name: str) -> str:
    """Convert internal agent name to human-readable display name."""
    # Remove date prefix and clean up the name
    if agent_name.startswith("20"):
        parts = agent_name.split("_", 1)
        name = parts[1] if len(parts) > 1 else agent_name
    else:
        name = agent_name

    # Convert underscores to spaces and title case
    name = name.replace("_", " ").title()

    # Handle specific known cases
    name_mappings = {
        "Openhands": "OpenHands",
        "Sweagent": "SWE-agent",
        "Patchpilot": "PatchPilot",
        "Augment Agent": "Augment Agent",
        "Refact Agent": "Refact Agent",
        "Moatless": "Moatless",
    }

    for old, new in name_mappings.items():
        if old in name:
            name = name.replace(old, new)

    return name
