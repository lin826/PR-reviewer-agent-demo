"""
In-memory cache for label statistics to avoid filesystem scanning on every request.
"""

from backend.services import file_service, scanner


class LabelStatsCache:
    """
    Maintains in-memory cache of label statistics.

    Tracks:
    - Per problem: (resolved_agents_with_labels, total_resolved_agents)
    - Per repo: (fully_labeled_issues, total_issues_with_resolved_agents)
    """

    def __init__(self):
        # problem_id -> (labeled_resolved_count, total_resolved_count)
        self._problem_stats: dict[str, tuple[int, int]] = {}

        # repo_name -> (fully_labeled_issues, total_issues_with_resolved_agents)
        self._repo_stats: dict[str, tuple[int, int]] = {}

    def rebuild_cache(self) -> None:
        """
        Rebuild the entire cache by scanning all problems and labels.
        Called on startup and admin refresh.
        """
        self._problem_stats.clear()
        self._repo_stats.clear()

        # Get all problems
        all_problems = scanner.get_problems()

        # Track repo issue counts
        repo_issue_counts: dict[str, int] = {}
        repo_fully_labeled_counts: dict[str, int] = {}

        for problem in all_problems:
            # Get all submissions for this problem
            submissions = scanner.get_all_agent_submissions(problem.problem_id)

            # Find resolved agents
            resolved_agents = [
                agent_name
                for agent_name, submission in submissions.items()
                if submission.resolved
            ]
            total_resolved = len(resolved_agents)

            # Only count issues that have at least one resolved agent
            if total_resolved == 0:
                continue

            # Count issues with resolved agents per repo
            repo_issue_counts[problem.repo] = repo_issue_counts.get(problem.repo, 0) + 1

            # Count resolved agents with labels
            labels = file_service.get_all_labels_for_problem(problem.problem_id)
            labeled_agent_names = {label.agent_name for label in labels}

            # Only count labels for resolved agents
            resolved_agents_with_labels = [
                agent for agent in resolved_agents if agent in labeled_agent_names
            ]
            labeled_resolved_count = len(resolved_agents_with_labels)

            # Store problem stats
            self._problem_stats[problem.problem_id] = (
                labeled_resolved_count,
                total_resolved,
            )

            # Check if this issue is fully labeled (all resolved agents have labels)
            if total_resolved > 0 and labeled_resolved_count == total_resolved:
                repo_fully_labeled_counts[problem.repo] = (
                    repo_fully_labeled_counts.get(problem.repo, 0) + 1
                )

        # Store repo stats
        for repo_name in repo_issue_counts:
            total_issues_with_resolved_agents = repo_issue_counts[repo_name]
            fully_labeled_issues = repo_fully_labeled_counts.get(repo_name, 0)
            self._repo_stats[repo_name] = (
                fully_labeled_issues,
                total_issues_with_resolved_agents,
            )

    def get_problem_label_stats(self, problem_id: str) -> tuple[int, int]:
        """
        Get label stats for a problem.
        Returns (resolved_agents_with_labels, total_resolved_agents).
        """
        return self._problem_stats.get(problem_id, (0, 0))

    def get_repo_label_stats(self, repo_name: str) -> tuple[int, int]:
        """
        Get label stats for a repository.
        Returns (fully_labeled_issues, total_issues_with_resolved_agents).
        """
        return self._repo_stats.get(repo_name, (0, 0))

    def update_problem_label_stats(
        self, problem_id: str, agent_name: str, has_label: bool
    ) -> None:
        """
        Incrementally update cache when a label is added/removed.

        Args:
            problem_id: The problem ID
            agent_name: The agent name
            has_label: True if label was added, False if removed
        """
        # Check if this agent resolved the problem
        submissions = scanner.get_all_agent_submissions(problem_id)
        submission = submissions.get(agent_name)
        if not submission or not submission.resolved:
            # Agent didn't resolve this problem, no cache update needed
            return

        # Get current stats
        labeled_count, total_count = self._problem_stats.get(problem_id, (0, 0))

        # Update labeled count
        if has_label:
            labeled_count = min(labeled_count + 1, total_count)
        else:
            labeled_count = max(labeled_count - 1, 0)

        # Store updated problem stats
        self._problem_stats[problem_id] = (labeled_count, total_count)

        # Update repo stats
        problem = scanner.get_problem(problem_id)
        if problem:
            self._update_repo_stats_for_problem_change(problem.repo, problem_id)

    def _update_repo_stats_for_problem_change(
        self, repo_name: str, problem_id: str
    ) -> None:
        """Update repo stats when a problem's label status changes."""
        # Get current repo stats
        (
            fully_labeled_issues,
            total_issues_with_resolved_agents,
        ) = self._repo_stats.get(repo_name, (0, 0))

        # We need to recount fully labeled issues for this repo to be accurate
        # This is simpler than tracking previous state
        repo_problems = scanner.get_problems(repo=repo_name)
        new_fully_labeled_count = 0
        new_total_issues_with_resolved_agents = 0

        for problem in repo_problems:
            prob_labeled, prob_total = self._problem_stats.get(
                problem.problem_id, (0, 0)
            )
            # Only count problems that have resolved agents
            if prob_total > 0:
                new_total_issues_with_resolved_agents += 1
                if prob_labeled == prob_total:
                    new_fully_labeled_count += 1

        # Update repo stats
        self._repo_stats[repo_name] = (
            new_fully_labeled_count,
            new_total_issues_with_resolved_agents,
        )


# Global cache instance
label_stats_cache = LabelStatsCache()
