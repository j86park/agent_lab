"""Agent Lab — Test Suites & Test Cases CRUD API routes."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session, async_session
from app.models import TestSuite, TestCase
from app.services.test_suite_service import run_suite_background
from app.schemas import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse,
    TestSuiteListResponse,
    TestCaseCreate,
    TestCaseUpdate,
    TestCaseResponse,
    TestCaseListResponse,
)


router = APIRouter(prefix="/api/suites", tags=["suites"])


# --- Test Suite Endpoints ---

@router.post("", response_model=TestSuiteResponse, status_code=status.HTTP_201_CREATED)
async def create_suite(
    suite_in: TestSuiteCreate, session: AsyncSession = Depends(get_session)
):
    """Create a new test suite for an agent."""
    suite = TestSuite(
        name=suite_in.name,
        description=suite_in.description,
        agent_id=suite_in.agent_id,
    )
    session.add(suite)
    await session.commit()
    await session.refresh(suite)
    return suite


@router.get("", response_model=TestSuiteListResponse)
async def list_suites(
    agent_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    """List all available test suites, optionally filtered by agent."""
    stmt = select(TestSuite).offset(skip).limit(limit).order_by(TestSuite.created_at.desc())
    if agent_id:
        stmt = stmt.where(TestSuite.agent_id == agent_id)
    
    result = await session.execute(stmt)
    suites = result.scalars().all()

    # Query for total count
    count_stmt = select(func.count()).select_from(TestSuite)
    if agent_id:
        count_stmt = count_stmt.where(TestSuite.agent_id == agent_id)
    
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0

    return {"suites": suites, "total": total}


@router.get("/{suite_id}", response_model=TestSuiteResponse)
async def get_suite(suite_id: str, session: AsyncSession = Depends(get_session)):
    """Get a single test suite by ID."""
    result = await session.execute(select(TestSuite).where(TestSuite.id == suite_id))
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test suite not found"
        )
    return suite


@router.put("/{suite_id}", response_model=TestSuiteResponse)
async def update_suite(
    suite_id: str, suite_in: TestSuiteUpdate, session: AsyncSession = Depends(get_session)
):
    """Update an existing test suite."""
    result = await session.execute(select(TestSuite).where(TestSuite.id == suite_id))
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test suite not found"
        )

    # Update only fields that were provided
    update_data = suite_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(suite, field, value)

    await session.commit()
    await session.refresh(suite)
    return suite


@router.delete("/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_suite(suite_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a test suite and all its cases (via CASCADE)."""
    result = await session.execute(select(TestSuite).where(TestSuite.id == suite_id))
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test suite not found"
        )
    
    await session.delete(suite)
    await session.commit()
    return None


@router.post("/{suite_id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_suite(
    suite_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session)
):
    """Trigger a background batch execution for the entire suite."""
    # Verify suite exists
    result = await session.execute(select(TestSuite).where(TestSuite.id == suite_id))
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test suite not found"
        )
    
    # Trigger background task
    # We pass the async_session factory so the background task can manage its own sessions
    background_tasks.add_task(run_suite_background, suite_id, async_session)
    
    return {"message": f"Suite execution triggered for '{suite.name}'"}


# --- Test Case Endpoints ---

@router.post("/{suite_id}/cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
async def create_test_case(
    suite_id: str, case_in: TestCaseCreate, session: AsyncSession = Depends(get_session)
):
    """Add a new test case to a specific suite."""
    # Verify suite exists
    suite_result = await session.execute(select(TestSuite).where(TestSuite.id == suite_id))
    if not suite_result.scalar_one_or_none():
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Target test suite not found"
        )

    case = TestCase(
        suite_id=suite_id,
        task=case_in.task,
        expected_behavior=case_in.expected_behavior,
        rubric=case_in.rubric,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)
    return case


@router.get("/{suite_id}/cases", response_model=TestCaseListResponse)
async def list_test_cases(
    suite_id: str, session: AsyncSession = Depends(get_session)
):
    """List all test cases in a suite."""
    stmt = select(TestCase).where(TestCase.suite_id == suite_id).order_by(TestCase.created_at.asc())
    result = await session.execute(stmt)
    cases = result.scalars().all()

    # Simple count from result length (cases are usually few)
    return {"cases": cases, "total": len(cases)}


@router.put("/cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: str, case_in: TestCaseUpdate, session: AsyncSession = Depends(get_session)
):
    """Update an existing test case."""
    result = await session.execute(select(TestCase).where(TestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found"
        )

    update_data = case_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(case, field, value)

    await session.commit()
    await session.refresh(case)
    return case


@router.delete("/cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case(case_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a test case."""
    result = await session.execute(select(TestCase).where(TestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found"
        )
    
    await session.delete(case)
    await session.commit()
    return None
