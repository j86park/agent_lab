"""Agent Lab — Workspace Snapshot & Checkpoint Engine.

Provides filesystem versioning for agent workspaces:
- Captures snapshots at each execution step.
- Enables rolling back workspaces to historical checkpoints.
- Clones workspace state for time-travel forking.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SNAPSHOTS_DIR_NAME = ".snapshots"


class WorkspaceService:
    """Service managing workspace snapshots, checkouts, and forking."""

    @staticmethod
    def get_snapshots_dir(workspace_dir: Path) -> Path:
        """Return the directory housing all step snapshots for a workspace."""
        d = workspace_dir / SNAPSHOTS_DIR_NAME
        d.mkdir(parents=True, exist_ok=True)
        return d

    def create_step_snapshot(self, workspace_dir: Path, step_index: int) -> Path:
        """
        Capture a full filesystem snapshot of the workspace at step_index.
        Skips internal directories like .snapshots and .git.
        """
        snapshots_dir = self.get_snapshots_dir(workspace_dir)
        target_snapshot_dir = snapshots_dir / f"step_{step_index}"

        if target_snapshot_dir.exists():
            shutil.rmtree(target_snapshot_dir)
        target_snapshot_dir.mkdir(parents=True, exist_ok=True)

        copied_count = 0
        for item in workspace_dir.iterdir():
            if item.name in [SNAPSHOTS_DIR_NAME, ".git", "__pycache__"]:
                continue

            dest = target_snapshot_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            elif item.is_file():
                shutil.copy2(item, dest)
            copied_count += 1

        logger.info(
            "Created workspace snapshot at step %d for %s (%d root entries)",
            step_index, workspace_dir.name, copied_count
        )
        return target_snapshot_dir

    def restore_step_snapshot(self, workspace_dir: Path, step_index: int) -> bool:
        """
        Restore the workspace files to match the snapshot at step_index.
        Removes current workspace files (excluding .snapshots) and replaces them.
        """
        snapshot_dir = workspace_dir / SNAPSHOTS_DIR_NAME / f"step_{step_index}"
        if not snapshot_dir.exists() or not snapshot_dir.is_dir():
            logger.warning(
                "Snapshot step_%d not found in %s", step_index, workspace_dir
            )
            return False

        # Clean existing files (except .snapshots and .git)
        for item in workspace_dir.iterdir():
            if item.name in [SNAPSHOTS_DIR_NAME, ".git"]:
                continue
            if item.is_dir():
                shutil.rmtree(item)
            elif item.is_file():
                item.unlink()

        # Restore from snapshot
        restored_count = 0
        for item in snapshot_dir.iterdir():
            dest = workspace_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            elif item.is_file():
                shutil.copy2(item, dest)
            restored_count += 1

        logger.info(
            "Restored workspace %s from step_%d (%d entries)",
            workspace_dir.name, step_index, restored_count
        )
        return True

    def clone_workspace_snapshot(
        self,
        src_workspace: Path,
        dst_workspace: Path,
        step_index: int,
    ) -> bool:
        """
        Initialize dst_workspace with the exact state of src_workspace at step_index.
        Also copies snapshots 0..step_index so the child run has full ancestry.
        """
        dst_workspace.mkdir(parents=True, exist_ok=True)
        snapshot_dir = src_workspace / SNAPSHOTS_DIR_NAME / f"step_{step_index}"

        # If snapshot exists, populate dst_workspace from it
        if snapshot_dir.exists() and snapshot_dir.is_dir():
            for item in snapshot_dir.iterdir():
                dest = dst_workspace / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                elif item.is_file():
                    shutil.copy2(item, dest)
        else:
            # If step 0 had no snapshot yet, copy existing files except .snapshots
            for item in src_workspace.iterdir():
                if item.name in [SNAPSHOTS_DIR_NAME, ".git"]:
                    continue
                dest = dst_workspace / item.name
                if item.is_dir():
                    shutil.copytree(item, dest, dirs_exist_ok=True)
                elif item.is_file():
                    shutil.copy2(item, dest)

        # Copy snapshots up to step_index
        src_snapshots = src_workspace / SNAPSHOTS_DIR_NAME
        if src_snapshots.exists():
            dst_snapshots = self.get_snapshots_dir(dst_workspace)
            for i in range(step_index + 1):
                s_folder = src_snapshots / f"step_{i}"
                if s_folder.exists() and s_folder.is_dir():
                    shutil.copytree(s_folder, dst_snapshots / f"step_{i}", dirs_exist_ok=True)

        logger.info(
            "Cloned workspace from %s (step %d) into %s",
            src_workspace.name, step_index, dst_workspace.name
        )
        return True

    def list_snapshots(self, workspace_dir: Path) -> list[int]:
        """Return a sorted list of integer step indices for existing snapshots."""
        snapshots_dir = workspace_dir / SNAPSHOTS_DIR_NAME
        if not snapshots_dir.exists():
            return []

        steps = []
        for entry in snapshots_dir.iterdir():
            if entry.is_dir() and entry.name.startswith("step_"):
                try:
                    step_num = int(entry.name.replace("step_", ""))
                    steps.append(step_num)
                except ValueError:
                    continue
        return sorted(steps)


workspace_service = WorkspaceService()
