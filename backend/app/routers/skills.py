"""Agent Lab — Skills CRUD API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Skill
from app.schemas import SkillCreate, SkillUpdate, SkillResponse, SkillListResponse


router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    skill_in: SkillCreate, session: AsyncSession = Depends(get_session)
):
    """Create a new reusable skill (instruction block)."""
    skill = Skill(
        name=skill_in.name,
        description=skill_in.description,
        instructions=skill_in.instructions,
    )
    session.add(skill)
    await session.commit()
    await session.refresh(skill)
    return skill


@router.get("", response_model=SkillListResponse)
async def list_skills(
    skip: int = 0, limit: int = 50, session: AsyncSession = Depends(get_session)
):
    """List all available skills with pagination."""
    # Query for skills
    skills_query = select(Skill).offset(skip).limit(limit).order_by(Skill.created_at.desc())
    skills_result = await session.execute(skills_query)
    skills = skills_result.scalars().all()

    # Query for total count
    count_query = select(func.count()).select_from(Skill)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    return {"skills": skills, "total": total}


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: str, session: AsyncSession = Depends(get_session)):
    """Get a single skill by ID."""
    result = await session.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return skill


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str, skill_in: SkillUpdate, session: AsyncSession = Depends(get_session)
):
    """Update an existing skill."""
    result = await session.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )

    # Update only fields that were provided
    update_data = skill_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)

    await session.commit()
    await session.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a skill."""
    result = await session.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    
    await session.delete(skill)
    await session.commit()
    return None
