from fastapi import APIRouter, HTTPException, Query

from backend.models import Problem, ProblemWithSubmissions
from backend.services import scanner

router = APIRouter(prefix="/problems", tags=["problems"])


# FastAPI Query parameter defaults are evaluated at import time, which is safe
# pyright: reportCallInDefaultInitializer=false


@router.get("/", response_model=list[Problem])
def list_problems(
    repo: str | None = Query(
        default=None, description="Filter by repository (e.g., 'django__django')"
    ),
    limit: int = Query(
        default=1000, ge=1, le=1000, description="Maximum number of results"
    ),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
) -> list[Problem]:
    """
    List all problems, optionally filtered by repository.

    Returns basic problem information without agent submissions.
    Use GET /problems/{problem_id} to get full details including submissions.
    """
    problems = scanner.get_problems(repo=repo)

    # Apply pagination
    paginated_problems = problems[offset : offset + limit]

    return paginated_problems


@router.get("/{problem_id}", response_model=ProblemWithSubmissions)
def get_problem(problem_id: str) -> ProblemWithSubmissions:
    """
    Get a specific problem with all agent submissions.

    Returns complete problem information including all agent submissions
    for the 3-panel viewer (ground truth, agent submission, user comments).
    """
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Get all agent submissions for this problem
    agent_submissions = scanner.get_all_agent_submissions(problem_id)

    return ProblemWithSubmissions(
        problem=problem,
        agents=agent_submissions,
    )


@router.get("/{problem_id}/stats")
def get_problem_stats(problem_id: str) -> dict[str, int | list[str]]:
    """Get statistics for a specific problem."""
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    agent_submissions = scanner.get_all_agent_submissions(problem_id)

    resolved_agents = [
        agent_name
        for agent_name, submission in agent_submissions.items()
        if submission.resolved
    ]

    return {
        "total_agents": len(agent_submissions),
        "resolved_count": len(resolved_agents),
        "failed_count": len(agent_submissions) - len(resolved_agents),
        "resolved_agents": resolved_agents,
    }
