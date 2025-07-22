from fastapi import APIRouter, HTTPException

from backend.models import PatchContent, PatchInfo
from backend.services import diff_parser, ground_truth_loader, scanner
from shared.models import PatchStats

router = APIRouter(prefix="/patches", tags=["patches"])


@router.get("/problems/{problem_id}/agents/{agent_name}", response_model=PatchContent)
def get_agent_patch(problem_id: str, agent_name: str) -> PatchContent:
    """
    Get agent patch content for a specific problem.

    Returns the full patch content with metadata for the 3-panel viewer.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Get agent submission
    submission = scanner.get_agent_submission(agent_name, problem_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' has no submission for problem '{problem_id}'",
        )

    # Load patch content
    content = scanner.load_patch_content(submission)
    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"Patch file not found: {submission.patch_file}",
        )

    # Parse patch metadata
    is_valid = diff_parser.validate_patch_format(content)
    changed_files = diff_parser.extract_changed_files(content)
    raw_stats = diff_parser.count_changes(content)

    # Convert to PatchStats model
    stats = PatchStats(
        file_count=len(changed_files),
        additions=raw_stats.get("additions", 0),
        deletions=raw_stats.get("deletions", 0),
    )

    return PatchContent(
        content=content,
        is_valid=is_valid,
        changed_files=changed_files,
        stats=stats,
    )


@router.get("/problems/{problem_id}/agents/{agent_name}/info", response_model=PatchInfo)
def get_agent_patch_info(problem_id: str, agent_name: str) -> PatchInfo:
    """
    Get agent patch metadata without loading full content.

    Useful for listing/preview without the overhead of loading large patches.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Get agent submission
    submission = scanner.get_agent_submission(agent_name, problem_id)
    if not submission:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' has no submission for problem '{problem_id}'",
        )

    # Check if file exists without loading content
    from pathlib import Path

    patch_file = Path(submission.patch_file)
    exists = patch_file.exists()

    if exists:
        # Load content to get stats (could be optimized to read only header)
        content = scanner.load_patch_content(submission)
        if content:
            changed_files = diff_parser.extract_changed_files(content)
            stats = diff_parser.count_changes(content)
            return PatchInfo(
                exists=True,
                file_path=submission.patch_file,
                file_count=len(changed_files),
                additions=stats["additions"],
                deletions=stats["deletions"],
            )

    return PatchInfo(
        exists=False,
        file_path=submission.patch_file,
        file_count=0,
        additions=0,
        deletions=0,
    )


@router.get("/problems/{problem_id}/ground_truth", response_model=PatchContent)
def get_ground_truth_patch(problem_id: str) -> PatchContent:
    """
    Get ground truth patch for a problem from SWE-bench verified dataset.
    """
    # Verify problem exists
    problem = scanner.get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem '{problem_id}' not found")

    # Try to load ground truth patch from SWE-bench dataset
    if ground_truth_loader.is_available():
        gt_patch = ground_truth_loader.get_ground_truth_patch(problem_id)

        if gt_patch and gt_patch.strip():
            # Parse ground truth patch metadata
            is_valid = diff_parser.validate_patch_format(gt_patch)
            changed_files = diff_parser.extract_changed_files(gt_patch)
            raw_stats = diff_parser.count_changes(gt_patch)

            # Convert to PatchStats model
            stats = PatchStats(
                file_count=len(changed_files),
                additions=raw_stats.get("additions", 0),
                deletions=raw_stats.get("deletions", 0),
            )

            return PatchContent(
                content=gt_patch,
                is_valid=is_valid,
                changed_files=changed_files,
                stats=stats,
            )

    # Fallback: return placeholder if ground truth not available or not found
    availability_msg = (
        " (SWE-bench dataset not loaded).\n\n"
        if not ground_truth_loader.is_available()
        else " in SWE-bench verified dataset.\n\n"
    )

    placeholder_content = (
        f"# Ground Truth Patch for {problem_id}\n\n"
        f"Ground truth patch not available{availability_msg}"
        f"Problem: {problem.problem_statement or 'No description available'}\n"
        f"Repository: {problem.repo}\n"
        f"GitHub: {problem.github_url}\n"
    )

    return PatchContent(
        content=placeholder_content,
        is_valid=False,  # Not a real patch
        changed_files=[],
        stats=PatchStats(file_count=0, additions=0, deletions=0),
    )
