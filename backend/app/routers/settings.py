"""Agent Lab — Settings API for provider configuration."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.schemas import SettingsUpdate, SettingsResponse
from app.services.encryption import get_or_create_key, encrypt_value, decrypt_value


router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_settings_path() -> Path:
    """Return the path to the settings.json file."""
    return settings.DATA_DIR / "settings.json"


def read_settings() -> dict:
    """Read raw settings from settings.json."""
    path = get_settings_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def write_settings(data: dict) -> None:
    """Write raw settings to settings.json."""
    path = get_settings_path()
    path.write_text(json.dumps(data, indent=2))


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """Check which provider API keys are configured."""
    data = read_settings()
    
    return {
        "openai_api_key_set": bool(data.get("openai_api_key")),
        "anthropic_api_key_set": bool(data.get("anthropic_api_key")),
        "openrouter_api_key_set": bool(data.get("openrouter_api_key")),
    }


@router.put("", response_model=SettingsResponse)
async def update_settings(settings_in: SettingsUpdate):
    """Securely store encrypted API keys."""
    # Get encryption key
    key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
    
    # Read existing data
    data = read_settings()
    
    # Update with new keys (encrypted)
    if settings_in.openai_api_key is not None:
        data["openai_api_key"] = encrypt_value(settings_in.openai_api_key, key)
    
    if settings_in.anthropic_api_key is not None:
        data["anthropic_api_key"] = encrypt_value(settings_in.anthropic_api_key, key)
        
    if settings_in.openrouter_api_key is not None:
        data["openrouter_api_key"] = encrypt_value(settings_in.openrouter_api_key, key)
        
    # Save back to file
    write_settings(data)
    
    return {
        "openai_api_key_set": bool(data.get("openai_api_key")),
        "anthropic_api_key_set": bool(data.get("anthropic_api_key")),
        "openrouter_api_key_set": bool(data.get("openrouter_api_key")),
    }
