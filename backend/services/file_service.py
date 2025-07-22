from datetime import datetime
from pathlib import Path

from backend.models import Label, LabelCreate, LabelResponse
from backend.services.data_scanner import scanner


class FileService:
    def __init__(self, labels_dir: str = "data/labels") -> None:
        self.labels_dir: Path = Path(labels_dir)

    def ensure_label_dir(self, agent_name: str) -> Path:
        """Ensure the label directory exists for an agent."""
        agent_dir = self.labels_dir / agent_name
        agent_dir.mkdir(parents=True, exist_ok=True)
        return agent_dir

    def get_label_file_path(self, problem_id: str, agent_name: str) -> Path:
        """Get the file path for a label."""
        return self.labels_dir / agent_name / f"{problem_id}.md"

    def load_label(self, problem_id: str, agent_name: str) -> Label | None:
        """Load a label from file."""
        label_file = self.get_label_file_path(problem_id, agent_name)

        if not label_file.exists():
            return None

        try:
            with open(label_file, encoding="utf-8") as f:
                content = f.read()

            # Get file timestamps
            stat = label_file.stat()
            created_at = datetime.fromtimestamp(stat.st_ctime)
            updated_at = datetime.fromtimestamp(stat.st_mtime)

            return Label(
                problem_id=problem_id,
                agent_name=agent_name,
                content=content,
                created_at=created_at,
                updated_at=updated_at,
            )
        except OSError as e:
            print(f"Warning: Failed to read label file {label_file}: {e}")
            return None

    def save_label(
        self, problem_id: str, agent_name: str, label_create: LabelCreate
    ) -> Label:
        """Save a label to file."""
        _ = self.ensure_label_dir(agent_name)
        label_file = self.get_label_file_path(problem_id, agent_name)

        # Check if file exists to determine created_at
        is_new = not label_file.exists()
        now = datetime.now()

        # Get created_at before writing if file exists
        existing_created_at: datetime | None = None
        if not is_new:
            try:
                existing_created_at = datetime.fromtimestamp(label_file.stat().st_ctime)
            except OSError:
                existing_created_at = now

        try:
            with open(label_file, "w", encoding="utf-8") as f:
                _ = f.write(label_create.content)

            # Set created_at and updated_at
            created_at = now if is_new else (existing_created_at or now)

            return Label(
                problem_id=problem_id,
                agent_name=agent_name,
                content=label_create.content,
                created_at=created_at,
                updated_at=now,
            )
        except OSError as e:
            raise RuntimeError(f"Failed to save label file {label_file}: {e}") from e

    def get_all_labels_for_problem(self, problem_id: str) -> list[Label]:
        """Get all labels for a problem."""
        labels: list[Label] = []

        # Get all available agents from the scanner
        agents = scanner.get_agents()

        for agent_name in agents:
            label = self.load_label(problem_id, agent_name)
            if label:
                labels.append(label)

        return sorted(labels, key=lambda label: label.updated_at, reverse=True)

    def delete_label(self, problem_id: str, agent_name: str) -> bool:
        """Delete a label file."""
        label_file = self.get_label_file_path(problem_id, agent_name)

        if label_file.exists():
            try:
                label_file.unlink()
                return True
            except OSError as e:
                print(f"Warning: Failed to delete label file {label_file}: {e}")

        return False

    def label_to_response(self, label: Label) -> LabelResponse:
        """Convert Label model to LabelResponse."""
        return LabelResponse(
            problem_id=label.problem_id,
            agent_name=label.agent_name,
            content=label.content,
            created_at=label.created_at.isoformat(),
            updated_at=label.updated_at.isoformat(),
        )


# Global file service instance
file_service = FileService()
