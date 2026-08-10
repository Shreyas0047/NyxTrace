"""
Document & URL LLM Enhancement Module (Option A — enhancer)

Optionally enhances heuristic document/URL analysis with LLM-generated
narratives via Ollama or OpenAI. The LLM acts as a second opinion only:
it never replaces the heuristic verdict. Falls back gracefully (returns
None) when the LLM is disabled, unreachable, or returns invalid JSON.
"""

import json
import logging
from typing import Optional

from app.core.config import config
from app.modules.llm_integration import _call_openai
from app.modules.llm_router import ping_ollama

logger = logging.getLogger(__name__)

MAX_TEXT_CHARS = 4000


def _truncate(text: str, limit: int = MAX_TEXT_CHARS) -> str:
    if not text:
        return ""
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"


def _build_document_prompt(
    filename: str,
    file_type: str,
    extracted_text: str,
    findings: list,
    embedded_urls: list,
    macro_risk: Optional[dict],
    threat_score: float,
    threat_level: str,
    predicted_threat: str,
) -> str:
    finding_lines = []
    for f in findings[:10]:
        ftype = f.get("type") or f.get("name") or "unknown"
        severity = f.get("severity") or "info"
        desc = (f.get("description") or "")[:200]
        finding_lines.append(f"- [{severity}] {ftype}: {desc}")
    findings_text = "\n".join(finding_lines) if finding_lines else "- None"

    urls_text = ", ".join(embedded_urls[:10]) if embedded_urls else "None"

    macro_text = "None"
    if macro_risk:
        macro_text = (
            f"{macro_risk.get('macro_count', 0)} macros, "
            f"{len(macro_risk.get('suspicious_strings', []))} suspicious strings, "
            f"auto-execute={'yes' if macro_risk.get('auto_execute') else 'no'}"
        )

    return f"""You are a forensic document analysis AI. A heuristic engine has already analyzed a document and produced a verdict. Your job is to provide a SECOND OPINION and an executive narrative — you do NOT override the heuristic verdict.

Heuristic Verdict:
- Filename: {filename}
- Type: {file_type}
- Threat Score: {threat_score:.1f}/100
- Threat Level: {threat_level}
- Predicted Threat: {predicted_threat}
- Findings: {len(findings)}

Heuristic Findings:
{findings_text}

Embedded URLs: {urls_text}
Macro Risk: {macro_text}

Extracted Document Text (first {MAX_TEXT_CHARS} chars):
\"\"\"
{_truncate(extracted_text)}
\"\"\"

Respond in JSON format with exactly these keys:
- "executive_summary": string, 2-3 sentence plain-language summary of the document and its risk
- "classification_opinion": string, your independent assessment (e.g. "phishing-document", "macro-dropper", "benign") with one sentence of rationale — state clearly it is an opinion
- "mitre_techniques": array of strings, MITRE ATT&CK technique IDs you believe apply
- "recommendations": array of strings, 2-4 actionable recommendations
- "llm_confidence": number between 0 and 1 describing your confidence in this opinion"""


def _build_url_prompt(
    url: str,
    hostname: str,
    tld: str,
    is_ip_based: bool,
    heuristics: list,
    indicators: list,
    risk_score: float,
    risk_level: str,
    phishing_probability: float,
) -> str:
    heuristic_lines = "\n".join(f"- {h}" for h in heuristics[:15]) if heuristics else "- None"

    indicator_lines = []
    for ind in indicators[:10]:
        itype = ind.get("type") or "unknown"
        desc = (ind.get("description") or ind.get("name") or "")[:150]
        indicator_lines.append(f"- [{itype}]: {desc}")
    indicators_text = "\n".join(indicator_lines) if indicator_lines else "- None"

    return f"""You are a URL phishing analysis AI. A heuristic engine has already analyzed a URL and produced a verdict. Your job is to provide a SECOND OPINION and an executive narrative — you do NOT override the heuristic verdict.

Heuristic Verdict:
- URL: {url}
- Hostname: {hostname}
- TLD: {tld}
- IP-Based URL: {'yes' if is_ip_based else 'no'}
- Risk Score: {risk_score:.1f}/100
- Risk Level: {risk_level}
- Phishing Probability: {phishing_probability:.2f}

Heuristics Triggered:
{heuristic_lines}

Indicators:
{indicators_text}

Respond in JSON format with exactly these keys:
- "executive_summary": string, 2-3 sentence plain-language summary of the URL and its risk
- "classification_opinion": string, your independent assessment (e.g. "phishing", "credential-harvesting", "benign") with one sentence of rationale — state clearly it is an opinion
- "mitre_techniques": array of strings, MITRE ATT&CK technique IDs you believe apply
- "recommendations": array of strings, 2-4 actionable recommendations
- "llm_confidence": number between 0 and 1 describing your confidence in this opinion"""


def _default_insights() -> dict:
    return {
        "llm_available": False,
        "provider": None,
        "model": None,
        "executive_summary": None,
        "classification_opinion": None,
        "mitre_techniques": [],
        "recommendations": [],
        "llm_confidence": None,
    }


async def _run_llm(prompt: str) -> Optional[dict]:
    """Call the configured LLM provider and parse the JSON response."""
    if config.LLM_PROVIDER == "openai":
        return await _call_openai(prompt)

    alive = await ping_ollama()
    if not alive:
        logger.warning("Ollama not reachable — document/URL LLM enhancement skipped")
        return None

    from app.modules.llm_router import call_ollama

    raw = await call_ollama(prompt)
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return None
        return parsed
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON response for document/URL enhancement")
        return None


def _finalize(parsed: Optional[dict]) -> dict:
    insights = _default_insights()
    if not parsed:
        return insights

    insights["llm_available"] = True
    insights["provider"] = config.LLM_PROVIDER
    insights["model"] = (
        config.LLM_OLLAMA_MODEL if config.LLM_PROVIDER == "ollama" else config.LLM_OPENAI_MODEL
    )
    insights["executive_summary"] = parsed.get("executive_summary")
    insights["classification_opinion"] = parsed.get("classification_opinion")
    insights["mitre_techniques"] = [
        t for t in (parsed.get("mitre_techniques") or []) if isinstance(t, str)
    ]
    insights["recommendations"] = [
        r for r in (parsed.get("recommendations") or []) if isinstance(r, str)
    ]
    try:
        insights["llm_confidence"] = round(float(parsed.get("llm_confidence") or 0.0), 2)
    except (TypeError, ValueError):
        insights["llm_confidence"] = 0.0
    return insights


async def generate_document_insights(
    filename: str,
    file_type: str,
    extracted_text: str,
    findings: list,
    embedded_urls: list,
    macro_risk: Optional[dict],
    threat_score: float,
    threat_level: str,
    predicted_threat: str,
) -> dict:
    """Generate LLM-enhanced insights for a document analysis. Never raises."""
    if not config.LLM_ENABLED:
        return _default_insights()

    prompt = _build_document_prompt(
        filename, file_type, extracted_text, findings, embedded_urls,
        macro_risk, threat_score, threat_level, predicted_threat,
    )
    try:
        parsed = await _run_llm(prompt)
        return _finalize(parsed)
    except Exception as e:
        logger.warning(f"Document LLM enhancement failed: {e}")
        return _default_insights()


async def generate_url_insights(
    url: str,
    hostname: str,
    tld: str,
    is_ip_based: bool,
    heuristics: list,
    indicators: list,
    risk_score: float,
    risk_level: str,
    phishing_probability: float,
) -> dict:
    """Generate LLM-enhanced insights for a URL analysis. Never raises."""
    if not config.LLM_ENABLED:
        return _default_insights()

    prompt = _build_url_prompt(
        url, hostname, tld, is_ip_based, heuristics, indicators,
        risk_score, risk_level, phishing_probability,
    )
    try:
        parsed = await _run_llm(prompt)
        return _finalize(parsed)
    except Exception as e:
        logger.warning(f"URL LLM enhancement failed: {e}")
        return _default_insights()
