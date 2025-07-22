"""
Ground truth patch loader for SWE-bench dataset.

This service loads ground truth patches from the SWE-bench-verified dataset
to provide reference solutions for comparison with agent submissions.
"""

import logging
from typing import Any

from datasets import Dataset, load_dataset
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class SWEBenchItem(BaseModel):
    instance_id: str
    patch: str
    repo: str
    base_commit: str
    problem_statement: str
    hints_text: str = ""
    test_patch: str = ""
    created_at: str = ""


class GroundTruthLoader:
    """Loads ground truth patches from SWE-bench verified dataset."""

    def __init__(self):
        self._dataset: Dataset | None = None
        self._dataset_loaded: bool = False
        self._load_dataset()

    def _load_dataset(self) -> None:
        """Load SWE-bench verified dataset on initialization."""
        logger.info("Loading SWE-bench verified dataset...")
        raw_dataset = load_dataset("princeton-nlp/SWE-bench_Verified", split="test")
        # Type narrowing - load_dataset with split="test" returns a Dataset
        assert isinstance(raw_dataset, Dataset), (
            "Expected Dataset from load_dataset with split='test'"
        )
        self._dataset = raw_dataset
        self._dataset_loaded = True
        logger.info(
            f"Loaded SWE-bench verified dataset with {len(self._dataset)} problems"
        )

    def get_ground_truth_patch(self, problem_id: str) -> str | None:
        """
        Get ground truth patch for a specific problem ID.

        Args:
            problem_id: Problem identifier (e.g., 'django__django-11066')

        Returns:
            Ground truth patch content as string, or None if not found
        """
        if not self._dataset_loaded or not self._dataset:
            return None

        # Find the problem in the dataset
        for item in self._dataset:  # pyright: ignore[reportUnknownVariableType]
            # Validate and parse the item with Pydantic
            swe_item = SWEBenchItem.model_validate(item)
            if swe_item.instance_id == problem_id:
                if swe_item.patch and swe_item.patch.strip():
                    logger.info(
                        f"Found ground truth patch for {problem_id}: "
                        f"{len(swe_item.patch)} chars"
                    )
                    return swe_item.patch
                else:
                    logger.warning(f"Ground truth patch for {problem_id} is empty")
                    return None

        logger.warning(f"Problem {problem_id} not found in SWE-bench dataset")
        return None

    def get_problem_info(self, problem_id: str) -> dict[str, str] | None:
        """
        Get detailed problem information from SWE-bench dataset.

        Args:
            problem_id: Problem identifier

        Returns:
            Dictionary with problem details, or None if not found
        """
        if not self._dataset_loaded or not self._dataset:
            return None

        for item in self._dataset:  # pyright: ignore[reportUnknownVariableType]
            swe_item = SWEBenchItem.model_validate(item)
            if swe_item.instance_id == problem_id:
                return {
                    "instance_id": swe_item.instance_id,
                    "repo": swe_item.repo,
                    "base_commit": swe_item.base_commit,
                    "problem_statement": swe_item.problem_statement,
                    "hints_text": swe_item.hints_text,
                    "test_patch": swe_item.test_patch,
                    "created_at": swe_item.created_at,
                }
        return None

    def is_available(self) -> bool:
        """Check if ground truth loading is available."""
        return self._dataset_loaded and self._dataset is not None

    def get_stats(self) -> dict[str, Any]:
        """Get statistics about the loaded dataset."""
        if not self._dataset_loaded or not self._dataset:
            return {"available": False, "total_problems": 0}

        return {
            "available": True,
            "total_problems": len(self._dataset),
            "dataset_name": "SWE-bench_Verified",
        }


# Global instance
ground_truth_loader = GroundTruthLoader()
