"""
Optional LLM Integration Module

Enhances analysis with LLM-generated narratives via Ollama or OpenAI.
Falls back gracefully to rule-based content if LLM is unavailable.
"""

import json
import logging
import httpx
from typing import Optional

from app.core.config import config

logger = logging.getLogger(__name__)


def _build_analysis_prompt(
    threat_type: str,
    severity_score: float,
    severity_level: str,
    mitre_techniques: list,
    key_findings: list,
    event_count: int,
) -> str:
    return f"""You are a forensic analysis AI. Given the following analysis results, generate a concise executive summary and 3-5 actionable recommendations.

Analysis Results:
- Threat Classification: {threat_type}
- Severity Score: {severity_score:.1f}/100 ({severity_level})
- MITRE Techniques Detected: {len(mitre_techniques)}
- Total Events Analyzed: {event_count}
- Key Findings: {', '.join(key_findings[:5]) if key_findings else 'None'}

Respond in JSON format with keys "executive_summary" (2-3 sentences) and "recommendations" (array of strings)."""


async def generate_llm_narrative(
    threat_type: str,
    severity_score: float,
    severity_level: str,
    mitre_techniques: list,
    key_findings: list,
    event_count: int,
) -> Optional[dict]:
    """Generate enhanced narrative via LLM. Returns None on failure (caller falls back)."""

    if not config.LLM_ENABLED:
        return None

    prompt = _build_analysis_prompt(
        threat_type, severity_score, severity_level,
        mitre_techniques, key_findings, event_count,
    )

    try:
        if config.LLM_PROVIDER == "ollama":
            return await _call_ollama(prompt)
        elif config.LLM_PROVIDER == "openai":
            return await _call_openai(prompt)
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")

    return None


async def _call_ollama(prompt: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as client:
        resp = await client.post(
            f"{config.LLM_OLLAMA_URL}/api/generate",
            json={
                "model": config.LLM_OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        response_text = data.get("response", "")
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            logger.warning("Ollama returned non-JSON response, falling back")
            return None


async def _call_openai(prompt: str) -> Optional[dict]:
    if not config.LLM_OPENAI_API_KEY:
        logger.warning("OpenAI API key not configured")
        return None

    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.LLM_OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": config.LLM_OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a forensic analysis AI. Respond in JSON."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None
