from fastapi import APIRouter, HTTPException

from backend.models import LabelCreate, LabelResponse
from backend.services import file_service, scanner

router = APIRouter(prefix="/labels", tags=["labels"])


# Put specific routes first to avoid conflicts
@router.get("/stats/{problem_id}")
def get_label_stats(problem_id: str) -> dict[str, int | list[str]]:
    """
    Get statistics about labels for a specific problem.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Get all labels for this problem
    labels = file_service.get_all_labels_for_problem(problem_id)

    # Get all possible agents for this problem
    all_submissions = scanner.get_all_agent_submissions(problem_id)

    labeled_agents = [label.agent_name for label in labels]
    unlabeled_agents = [
        agent for agent in all_submissions if agent not in labeled_agents
    ]

    return {
        "total_agents": len(all_submissions),
        "labeled_count": len(labeled_agents),
        "unlabeled_count": len(unlabeled_agents),
        "labeled_agents": labeled_agents,
        "unlabeled_agents": unlabeled_agents,
    }


@router.get("/problem/{problem_id}", response_model=list[LabelResponse])
def get_all_labels_for_problem(problem_id: str) -> list[LabelResponse]:
    """
    Get all user labels/comments for a specific problem.

    Returns labels from all agents that have been commented on for this problem.
    Useful for overview or bulk operations.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Get all labels for this problem
    labels = file_service.get_all_labels_for_problem(problem_id)
    return [file_service.label_to_response(label) for label in labels]


# Generic routes last
@router.get("/{problem_id}/{agent_name}", response_model=LabelResponse | None)
def get_label(problem_id: str, agent_name: str) -> LabelResponse | None:
    """
    Get user label/comment for a specific problem-agent combination.

    Returns None (204 No Content) if no label exists yet.
    This supports the 3rd panel in the viewer for user comments.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Verify agent submission exists
    submission = scanner.get_agent_submission(agent_name, problem_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' has no submission for problem '{problem_id}'",
        )

    # Load label if it exists
    label = file_service.load_label(problem_id, agent_name)
    if label:
        return file_service.label_to_response(label)

    return None


@router.post("/{problem_id}/{agent_name}", response_model=LabelResponse)
def save_label(
    problem_id: str, agent_name: str, label_create: LabelCreate
) -> LabelResponse:
    """
    Save user label/comment for a specific problem-agent combination.

    Creates or updates the markdown comment for the 3rd panel in the viewer.
    Labels are stored as files: labels/{problem_id}/{agent_name}.md
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Verify agent submission exists
    submission = scanner.get_agent_submission(agent_name, problem_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' has no submission for problem '{problem_id}'",
        )

    # Save the label
    label = file_service.save_label(problem_id, agent_name, label_create)
    return file_service.label_to_response(label)


@router.delete("/{problem_id}/{agent_name}")
def delete_label(problem_id: str, agent_name: str) -> dict[str, str]:
    """
    Delete user label/comment for a specific problem-agent combination.

    Removes the markdown file from the filesystem.
    """
    # Verify problem exists (but allow deletion even if problem is missing)
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Attempt to delete the label
    deleted = file_service.delete_label(problem_id, agent_name)

    if deleted:
        return {"message": f"Label deleted for {problem_id}/{agent_name}"}
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No label found for {problem_id}/{agent_name}",
        )
