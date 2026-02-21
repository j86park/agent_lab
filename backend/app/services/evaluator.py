"""Agent Lab — LLM-as-a-Judge Evaluation Service.

Grades agent execution results against test case expectations and rubrics.
"""

import json
import logging
from typing import Dict, Any, Optional

from app.models import Run, TestCase, RunLog
from app.services.llm.base import LLMMessage
from app.services.llm.factory import get_provider

logger = logging.getLogger(__name__)

EVAL_MODEL = "openai/gpt-4o-mini"
EVAL_PROVIDER = "openrouter"

SYSTEM_PROMPT = """
You are an expert autonomous agent evaluator. Your task is to judge the performance of an AI agent based on its execution logs and the target expectations.

You will be provided with:
1. The original task description.
2. The expected behavior/output.
3. A grading rubric (optional).
4. The full execution logs of the agent.

### Instructions:
- Analyze the logs to see if the agent successfully achieved the task.
- Compare the final outcome and the intermediate steps against the expected behavior.
- Use the rubric (if provided) to refine your score.
- Provide a score between 0.0 (total failure) and 1.0 (perfect success).
- Provide concise, actionable feedback explaining why you gave that score.

### Output Format:
You MUST respond with a valid JSON object strictly following this structure:
{
  "score": float,
  "feedback": "string"
}
"""

class EvaluationService:
    """
    Automated evaluator using LLM-as-a-judge.
    """

    def __init__(self, provider_name: str = EVAL_PROVIDER, model: str = EVAL_MODEL):
        self.provider = get_provider(provider_name)
        self.model = model

    async def evaluate_run(
        self, 
        run: Run, 
        test_case: TestCase, 
        logs: list[RunLog]
    ) -> Dict[str, Any]:
        """
        Grades a completed run and returns a score and feedback.
        """
        logger.info(f"Evaluating run {run.id} against test case {test_case.id}")

        # Format logs for the prompt
        formatted_logs = "\n".join([
            f"[{log.timestamp.isoformat()}] {log.level.upper()}: {log.message}"
            for log in logs
        ])

        user_content = f"""
### Task:
{test_case.task}

### Expected Behavior:
{test_case.expected_behavior}

### Rubric:
{test_case.rubric or "No specific rubric provided."}

### Execution Logs:
{formatted_logs}
"""

        messages = [
            LLMMessage(role="system", content=SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_content)
        ]

        try:
            response = await self.provider.chat(
                messages=messages,
                model=self.model,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.content)
            
            # Basic validation of the response
            score = float(result.get("score", 0.0))
            feedback = str(result.get("feedback", "No feedback provided."))
            
            # Clamp score
            score = max(0.0, min(1.0, score))

            logger.info(f"Evaluation complete for run {run.id}: score={score}")
            return {"score": score, "feedback": feedback}

        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Evaluation failed for run {run.id}: {str(e)}")
            return {
                "score": 0.0,
                "feedback": f"Evaluation error: {str(e)}"
            }
