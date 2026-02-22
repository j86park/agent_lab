"""Agent Lab — Prompt Snippets CRUD API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import PromptSnippet
from app.schemas import (
    PromptSnippetCreate,
    PromptSnippetUpdate,
    PromptSnippetResponse,
    PromptSnippetListResponse,
)


router = APIRouter(prefix="/api/snippets", tags=["snippets"])


@router.post("", response_model=PromptSnippetResponse, status_code=status.HTTP_201_CREATED)
async def create_snippet(
    snippet_in: PromptSnippetCreate, session: AsyncSession = Depends(get_session)
):
    """Create a new prompt snippet for the library."""
    snippet = PromptSnippet(
        name=snippet_in.name,
        content=snippet_in.content,
    )
    session.add(snippet)
    await session.commit()
    await session.refresh(snippet)
    return snippet


@router.get("", response_model=PromptSnippetListResponse)
async def list_snippets(
    skip: int = 0, limit: int = 100, session: AsyncSession = Depends(get_session)
):
    """List all available prompt snippets with pagination."""
    # Query for snippets
    stmt = select(PromptSnippet).offset(skip).limit(limit).order_by(PromptSnippet.name.asc())
    result = await session.execute(stmt)
    snippets = result.scalars().all()

    # Query for total count
    count_stmt = select(func.count()).select_from(PromptSnippet)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0

    return {"snippets": snippets, "total": total}


@router.get("/{snippet_id}", response_model=PromptSnippetResponse)
async def get_snippet(snippet_id: str, session: AsyncSession = Depends(get_session)):
    """Get a single prompt snippet by ID."""
    result = await session.execute(select(PromptSnippet).where(PromptSnippet.id == snippet_id))
    snippet = result.scalar_one_or_none()
    if not snippet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found"
        )
    return snippet


@router.put("/{snippet_id}", response_model=PromptSnippetResponse)
async def update_snippet(
    snippet_id: str, snippet_in: PromptSnippetUpdate, session: AsyncSession = Depends(get_session)
):
    """Update an existing prompt snippet."""
    result = await session.execute(select(PromptSnippet).where(PromptSnippet.id == snippet_id))
    snippet = result.scalar_one_or_none()
    if not snippet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found"
        )

    # Update only fields that were provided
    update_data = snippet_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(snippet, field, value)

    await session.commit()
    await session.refresh(snippet)
    return snippet


@router.delete("/{snippet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snippet(snippet_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a prompt snippet."""
    result = await session.execute(select(PromptSnippet).where(PromptSnippet.id == snippet_id))
    snippet = result.scalar_one_or_none()
    if not snippet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found"
        )
    
    await session.delete(snippet)
    await session.commit()
    return None
