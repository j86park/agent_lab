"""Agent Lab — Test Suite Service.

Handles batch execution of test suites by creating individual runs
for each test case and orchestrating their execution.
"""

import logging
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TestSuite, TestCase, Run
from app.services.orchestrator import AgentOrchestrator
from app.schemas import RunCreate

logger = logging.getLogger(__name__)

async def execute_test_suite(suite_id: str, session: AsyncSession) -> List[str]:
    """
    Triggers a batch execution for all cases in a test suite.
    Returns a list of created run IDs.
    """
    # 1. Load suite and its cases
    stmt = select(TestSuite).where(TestSuite.id == suite_id)
    result = await session.execute(stmt)
    suite = result.scalar_one_or_none()
    
    if not suite:
        logger.error(f"TestSuite {suite_id} not found")
        return []

    case_stmt = select(TestCase).where(TestCase.suite_id == suite_id)
    case_result = await session.execute(case_stmt)
    test_cases = case_result.scalars().all()

    if not test_cases:
        logger.warning(f"TestSuite {suite_id} has no test cases")
        return []

    run_ids = []
    
    # 2. Create a Run for each case
    for case in test_cases:
        run = Run(
            agent_id=suite.agent_id,
            task=case.task,
            status="pending",
            test_case_id=case.id,
            tags=f"suite:{suite.name}"
        )
        session.add(run)
        # Flush to get the ID but don't commit yet to keep it atomic in the batch
        await session.flush()
        run_ids.append(run.id)

    # Commit all runs
    await session.commit()
    
    logger.info(f"Triggered batch execution for suite {suite.name} ({len(run_ids)} runs)")
    return run_ids

async def run_suite_background(suite_id: str, session_factory):
    """
    Background task wrapper to execute a suite and trigger orchestrator for each run.
    """
    async with session_factory() as session:
        run_ids = await execute_test_suite(suite_id, session)
        
    # Trigger orchestrator for each run
    # Note: We do this outside the main session to avoid transaction conflicts
    # in the orchestrator's internal session management.
    orchestrator = AgentOrchestrator()
    for rid in run_ids:
        # We start each run asynchronously in the background
        import asyncio
        asyncio.create_task(orchestrator.execute_run(rid))
