from pathlib import Path


class DiffParser:
    """Service for parsing and processing .diff files."""

    def load_patch_content(self, patch_file_path: str) -> str | None:
        """
        Load patch content from a .diff file.

        Returns None if file doesn't exist or can't be read.
        Raises RuntimeError for encoding/IO errors.
        """
        patch_file = Path(patch_file_path)

        if not patch_file.exists():
            return None

        if not patch_file.is_file():
            raise RuntimeError(f"Patch path is not a file: {patch_file}")

        # Try UTF-8 first, then fallback to latin-1 for binary diffs
        for encoding in ["utf-8", "latin-1"]:
            try:
                with open(patch_file, encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue

        raise RuntimeError(
            f"Failed to decode patch file {patch_file} with UTF-8 or latin-1"
        )

    def validate_patch_format(self, content: str) -> bool:
        """
        Basic validation that content looks like a patch/diff.

        Returns True if content appears to be a valid patch format.
        """
        if not content or not content.strip():
            return False

        lines = content.strip().split("\n")

        # Check for common diff/patch indicators
        diff_indicators = [
            "--- ",  # Original file marker
            "+++ ",  # Modified file marker
            "@@",  # Hunk header
            "diff ",  # Git diff header
            "Index:",  # SVN-style diff
        ]

        return any(
            any(line.startswith(indicator) for indicator in diff_indicators)
            for line in lines[:10]  # Check first 10 lines
        )

    def extract_changed_files(self, content: str) -> list[str]:
        """
        Extract list of files that were changed in the patch.

        Returns list of file paths mentioned in the patch.
        """
        if not content:
            return []

        files: set[str] = set()
        lines = content.split("\n")

        for line in lines:
            # Git diff format
            if line.startswith("diff --git "):
                # Extract: diff --git a/file.py b/file.py
                parts = line.split()
                if len(parts) >= 4:
                    file_a = parts[2][2:]  # Remove 'a/' prefix
                    file_b = parts[3][2:]  # Remove 'b/' prefix
                    files.add(file_a)
                    if file_a != file_b:  # Renamed file
                        files.add(file_b)

            # Traditional diff format
            elif line.startswith("--- "):
                # Extract: --- a/file.py
                file_path = line[4:].strip()
                if file_path.startswith("a/"):
                    file_path = file_path[2:]
                if file_path not in ["", "/dev/null"]:
                    files.add(file_path)

            elif line.startswith("+++ "):
                # Extract: +++ b/file.py
                file_path = line[4:].strip()
                if file_path.startswith("b/"):
                    file_path = file_path[2:]
                if file_path not in ["", "/dev/null"]:
                    files.add(file_path)

        return sorted(files)

    def count_changes(self, content: str) -> dict[str, int]:
        """
        Count additions, deletions, and context lines in the patch.

        Returns dict with counts of different line types.
        """
        if not content:
            return {"additions": 0, "deletions": 0, "context": 0, "total_lines": 0}

        lines = content.split("\n")
        additions = 0
        deletions = 0
        context = 0

        for line in lines:
            if line.startswith("+") and not line.startswith("+++"):
                additions += 1
            elif line.startswith("-") and not line.startswith("---"):
                deletions += 1
            elif line.startswith(" "):  # Context line in unified diff
                context += 1

        return {
            "additions": additions,
            "deletions": deletions,
            "context": context,
            "total_lines": len(lines),
        }

    def format_for_display(self, content: str) -> str:
        """
        Format patch content for display in the frontend.

        Currently just returns content as-is, but could add:
        - Syntax highlighting markers
        - Line numbering
        - HTML escaping
        """
        return content.strip() if content else ""


# Global diff parser instance
diff_parser = DiffParser()
