"""Agent Lab — Metadata API routes."""

from fastapi import APIRouter
from app.services.llm.openai_provider import OPENAI_PRICING
from app.services.llm.anthropic_provider import ANTHROPIC_PRICING
from app.services.llm.openrouter_provider import OPENROUTER_PRICING

router = APIRouter(prefix="/api/metadata", tags=["metadata"])

@router.get("/models")
async def get_model_metadata():
    """Get a unified list of models and their pricing metadata."""
    models = []

    # OpenAI
    for model_id, (in_price, out_price) in OPENAI_PRICING.items():
        models.append({
            "id": model_id,
            "provider": "openai",
            "name": f"OpenAI: {model_id}",
            "input_price_1m": in_price,
            "output_price_1m": out_price,
        })

    # Anthropic
    for model_id, (in_price, out_price) in ANTHROPIC_PRICING.items():
        models.append({
            "id": model_id,
            "provider": "anthropic",
            "name": f"Anthropic: {model_id}",
            "input_price_1m": in_price,
            "output_price_1m": out_price,
        })

    # OpenRouter
    for model_id, (in_price, out_price) in OPENROUTER_PRICING.items():
        models.append({
            "id": model_id,
            "provider": "openrouter",
            "name": f"OpenRouter: {model_id}",
            "input_price_1m": in_price,
            "output_price_1m": out_price,
        })

    # Ollama (Free/Local)
    ollama_models = ["llama3", "codellama", "mistral", "phi3"]
    for model_id in ollama_models:
        models.append({
            "id": model_id,
            "provider": "ollama",
            "name": f"Ollama: {model_id}",
            "input_price_1m": 0.0,
            "output_price_1m": 0.0,
        })

    return {"models": models}
