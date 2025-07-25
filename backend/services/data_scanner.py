import json
from pathlib import Path

from backend.models import AgentResults, AgentSubmission, Problem

from .ground_truth_loader import ground_truth_loader


class DataScanner:
    def __init__(self, data_dir: str = "data/submissions") -> None:
        self.data_dir: Path = Path(data_dir)
        self._agents: list[str] = []
        self._repos: list[str] = []
        self._problems: dict[str, Problem] = {}
        self._agent_submissions: dict[str, dict[str, AgentSubmission]] = {}
        self._agent_results: dict[str, AgentResults] = {}

    def scan_data(self) -> None:
        """Scan the submissions directory and index all data."""
        if not self.data_dir.exists():
            raise FileNotFoundError(f"Data directory not found: {self.data_dir}")

        self._scan_agents()
        self._scan_problems()
        self._load_agent_results()

    def _scan_agents(self) -> None:
        """Scan for available agents."""
        self._agents = [
            dir.name
            for dir in self.data_dir.iterdir()
            if dir.is_dir() and not dir.name.startswith(".")
        ]
        self._agents.sort()

    def _scan_problems(self) -> None:
        """Scan for problems and build the index."""
        all_problem_ids: set[str] = set()

        # First pass: collect all problem IDs from all agents
        for agent_dir in self.data_dir.iterdir():
            if not agent_dir.is_dir() or agent_dir.name.startswith("."):
                continue

            for patch_file in agent_dir.glob("*_patch.diff"):
                problem_id = self._extract_problem_id(patch_file.name)
                if problem_id:
                    all_problem_ids.add(problem_id)

        # Second pass: create Problem objects and AgentSubmissions
        for problem_id in all_problem_ids:
            repo, issue_number = self._parse_problem_id(problem_id)

            # Get additional problem info from ground truth dataset
            ground_truth_info = ground_truth_loader.get_problem_info(problem_id)
            base_commit = (
                ground_truth_info.get("base_commit", "") if ground_truth_info else ""
            )
            problem_statement = (
                ground_truth_info.get("problem_statement", "")
                if ground_truth_info
                else ""
            )

            problem = Problem(
                problem_id=problem_id,
                repo=repo,
                issue_number=issue_number,
                base_commit=base_commit,
                problem_statement=problem_statement,
                github_url=self._generate_github_url(repo, issue_number),
                ground_truth_patch=None,
            )

            self._problems[problem_id] = problem

            # Track unique repositories
            if repo not in self._repos:
                self._repos.append(repo)

        self._repos.sort()

        # Third pass: collect agent submissions for each problem
        for agent_name in self._agents:
            agent_dir = self.data_dir / agent_name
            self._agent_submissions[agent_name] = {}

            for problem_id in all_problem_ids:
                repo, issue_number = self._parse_problem_id(problem_id)
                patch_file = agent_dir / f"{problem_id}_patch.diff"

                submission = AgentSubmission(
                    agent_name=agent_name,
                    patch_file=str(patch_file),
                    resolved=False,  # Will be updated from results.json
                    patch_content=None,  # Loaded on demand
                )

                self._agent_submissions[agent_name][problem_id] = submission

    def _load_agent_results(self) -> None:
        """Load results.json for each agent to determine resolved status."""
        for agent_name in self._agents:
            results_file = self.data_dir / agent_name / "results.json"
            if results_file.exists():
                with open(results_file) as f:
                    raw_data = json.load(f)  # pyright: ignore[reportAny]

                # Parse with Pydantic for type safety - let validation errors propagate
                agent_results = AgentResults.model_validate(raw_data)
                self._agent_results[agent_name] = agent_results

                # Update resolved status for submissions
                resolved_problems = set(agent_results.resolved)
                for problem_id in self._agent_submissions[agent_name]:
                    if problem_id in resolved_problems:
                        self._agent_submissions[agent_name][problem_id].resolved = True

    def _extract_problem_id(self, filename: str) -> str | None:
        """Extract problem ID from filename like 'django__django-10097_patch.diff'."""
        if not filename.endswith("_patch.diff"):
            return None
        return filename[:-11]  # Remove '_patch.diff'

    def _parse_problem_id(self, problem_id: str) -> tuple[str, str]:
        """Parse problem ID into repo and issue number."""
        # Format: org__repo-issue_number
        if "-" in problem_id:
            repo_part, issue_number = problem_id.rsplit("-", 1)
            return repo_part, issue_number
        return problem_id, ""

    def _generate_github_url(self, repo: str, issue_number: str) -> str:
        """Generate GitHub repository URL."""
        if "__" in repo:
            org, repo_name = repo.split("__", 1)
            return f"https://github.com/{org}/{repo_name}"
        return ""

    # Public interface methods
    def get_agents(self) -> list[str]:
        """Get list of all available agents."""
        return self._agents.copy()

    def get_repos(self) -> list[str]:
        """Get list of all available repositories."""
        return self._repos.copy()

    def get_problems(self, repo: str | None = None) -> list[Problem]:
        """Get list of problems, optionally filtered by repository."""
        problems = list(self._problems.values())
        if repo:
            problems = [p for p in problems if p.repo == repo]
        return sorted(problems, key=lambda p: p.problem_id)

    def get_problem(self, problem_id: str) -> Problem | None:
        """Get a specific problem by ID."""
        return self._problems.get(problem_id)

    def get_agent_submission(
        self, agent_name: str, problem_id: str
    ) -> AgentSubmission | None:
        """Get agent submission for a specific problem."""
        return self._agent_submissions.get(agent_name, {}).get(problem_id)

    def get_all_agent_submissions(self, problem_id: str) -> dict[str, AgentSubmission]:
        """Get all agent submissions for a problem."""
        submissions: dict[str, AgentSubmission] = {}
        for agent_name in self._agents:
            submission = self.get_agent_submission(agent_name, problem_id)
            if submission:
                submissions[agent_name] = submission
        return submissions

    def load_patch_content(self, submission: AgentSubmission) -> str | None:
        """Load patch content from file for a submission."""
        # Import here to avoid circular imports
        from .diff_parser import diff_parser

        try:
            content = diff_parser.load_patch_content(submission.patch_file)
            if content is not None:
                submission.patch_content = content
            return content
        except RuntimeError as e:
            print(f"Warning: Failed to read patch file {submission.patch_file}: {e}")
            return None

    def get_stats(self) -> dict[str, int]:
        """Get statistics about the indexed data."""
        return {
            "agents": len(self._agents),
            "repositories": len(self._repos),
            "problems": len(self._problems),
            "total_submissions": sum(
                len(subs) for subs in self._agent_submissions.values()
            ),
        }


# Global scanner instance
scanner = DataScanner()
