"""Agent Lab — WebSocket router for real-time run log streaming."""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.database import async_session
from app.models import Run, RunLog
from app.schemas import RunLogResponse, RunResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

POLL_INTERVAL_SECONDS = 1.0


@router.websocket("/ws/runs/{run_id}")
async def stream_run_logs(websocket: WebSocket, run_id: str) -> None:
    """
    Stream run logs in real-time via WebSocket.

    Protocol:
      1. On connect → send all existing logs as an initial batch.
      2. Poll DB every 1s for new logs (WHERE id > last_seen_id).
      3. Send each new log as: {"type": "log", "data": {...}}
      4. When run status is completed/failed → send final status
         message and close connection.

    Message formats:
      - Log entry:   {"type": "log",    "data": {RunLogResponse fields}}
      - Status:      {"type": "status", "status": "completed"|"failed",
                      "run": {RunResponse fields}}
    """
    await websocket.accept()
    logger.info("WebSocket connected for run %s", run_id)

    last_seen_id = 0

    try:
        async with async_session() as session:
            # Verify run exists
            run = await session.get(Run, run_id)
            if run is None:
                await websocket.send_json(
                    {"type": "error", "message": f"Run '{run_id}' not found"}
                )
                await websocket.close(code=1008)
                return

            # ── Send initial batch of existing logs ────────────────────
            stmt = (
                select(RunLog)
                .where(RunLog.run_id == run_id)
                .order_by(RunLog.id.asc())
            )
            result = await session.execute(stmt)
            existing_logs = result.scalars().all()

            for log_entry in existing_logs:
                log_data = RunLogResponse.model_validate(log_entry).model_dump(
                    mode="json"
                )
                await websocket.send_json({"type": "log", "data": log_data})
                last_seen_id = log_entry.id

            # If run is already done, send final status and close
            if run.status in ("completed", "failed"):
                run_data = RunResponse.model_validate(run).model_dump(mode="json")
                await websocket.send_json(
                    {"type": "status", "status": run.status, "run": run_data}
                )
                await websocket.close()
                return

            # ── Poll for new logs ──────────────────────────────────────
            while True:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)

                # Refresh the session to see new data
                await session.expire_all()

                # Fetch new logs since last seen
                new_stmt = (
                    select(RunLog)
                    .where(RunLog.run_id == run_id, RunLog.id > last_seen_id)
                    .order_by(RunLog.id.asc())
                )
                new_result = await session.execute(new_stmt)
                new_logs = new_result.scalars().all()

                for log_entry in new_logs:
                    log_data = RunLogResponse.model_validate(log_entry).model_dump(
                        mode="json"
                    )
                    await websocket.send_json({"type": "log", "data": log_data})
                    last_seen_id = log_entry.id

                # Check run status
                run = await session.get(Run, run_id)
                if run and run.status in ("completed", "failed"):
                    run_data = RunResponse.model_validate(run).model_dump(mode="json")
                    await websocket.send_json(
                        {"type": "status", "status": run.status, "run": run_data}
                    )
                    await websocket.close()
                    return

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for run %s", run_id)
    except Exception as exc:
        logger.exception("WebSocket error for run %s: %s", run_id, exc)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
