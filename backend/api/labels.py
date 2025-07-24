from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models import LabelCreate, LabelResponse
from backend.services import file_service, scanner
from backend.services.label_stats_cache import label_stats_cache


class DraftCreate(BaseModel):
    content: str


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

    # Update cache stats
    label_stats_cache.update_problem_label_stats(problem_id, agent_name, has_label=True)

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
        # Update cache stats
        label_stats_cache.update_problem_label_stats(
            problem_id, agent_name, has_label=False
        )
        return {"message": f"Label deleted for {problem_id}/{agent_name}"}
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No label found for {problem_id}/{agent_name}",
        )


# Draft endpoints
@router.post("/{problem_id}/{agent_name}/draft")
def save_draft(
    problem_id: str, agent_name: str, draft_create: DraftCreate
) -> dict[str, str]:
    """
    Save a draft for a specific problem-agent combination.

    Drafts are stored as .draft.md files alongside labels.
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

    try:
        file_service.save_draft(problem_id, agent_name, draft_create.content)
        return {"message": f"Draft saved for {problem_id}/{agent_name}"}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{problem_id}/{agent_name}/draft")
def get_draft(problem_id: str, agent_name: str) -> dict[str, str] | None:
    """
    Get a draft for a specific problem-agent combination.

    Returns None if no draft exists.
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

    content = file_service.load_draft(problem_id, agent_name)
    if content is not None:
        return {"content": content}

    return None


@router.post("/{problem_id}/{agent_name}/commit", response_model=LabelResponse)
def commit_draft(problem_id: str, agent_name: str) -> LabelResponse:
    """
    Commit a draft by moving it to the label file.

    This is an atomic file move operation.
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

    try:
        label = file_service.commit_draft(problem_id, agent_name)

        # Update cache stats
        label_stats_cache.update_problem_label_stats(
            problem_id, agent_name, has_label=True
        )

        return file_service.label_to_response(label)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/{problem_id}/{agent_name}/draft")
def delete_draft(problem_id: str, agent_name: str) -> dict[str, str]:
    """
    Delete a draft for a specific problem-agent combination.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    deleted = file_service.delete_draft(problem_id, agent_name)

    if deleted:
        return {"message": f"Draft deleted for {problem_id}/{agent_name}"}
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No draft found for {problem_id}/{agent_name}",
        )
