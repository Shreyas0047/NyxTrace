"""
AI Service Configuration
"""

import os

class AIServiceConfig:
    """AI Service Configuration"""

    # Service settings
    SERVICE_NAME: str = "Forensic AI Analysis Engine"
    SERVICE_VERSION: str = "1.0.0"
    HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))

    # Analysis settings
    MAX_TELEMETRY_EVENTS: int = 10000
    MAX_PROCESSING_TIME: int = 300  # seconds

    # Severity thresholds
    CRITICAL_THRESHOLD: float = 80.0
    HIGH_THRESHOLD: float = 60.0
    MEDIUM_THRESHOLD: float = 40.0

    # Feature extraction settings
    MIN_PROCESS_COUNT: int = 5
    SUSPICIOUS_COMMAND_PATTERNS_ENABLED: bool = True

    # Anomaly detection
    ANOMALY_ZSCORE_THRESHOLD: float = 2.5

    # Summarization settings
    MAX_SUMMARY_LENGTH: int = 500
    EXECUTIVE_SUMMARY_LENGTH: int = 200

    # Classification confidence threshold
    MIN_CONFIDENCE: float = 0.5

    # API Key (optional — when set, all requests except /health must include Authorization: Bearer <key>)
    API_KEY: str = os.getenv("AI_API_KEY", "")

    # CORS
    CORS_ORIGINS: list = os.getenv("AI_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173").split(",")

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("AI_RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_REQUESTS: int = int(os.getenv("AI_RATE_LIMIT_REQUESTS", "60"))
    RATE_LIMIT_WINDOW: int = int(os.getenv("AI_RATE_LIMIT_WINDOW", "60"))  # seconds

    # LLM integration
    LLM_ENABLED: bool = os.getenv("AI_LLM_ENABLED", "false").lower() == "true"
    LLM_PROVIDER: str = os.getenv("AI_LLM_PROVIDER", "ollama")  # ollama | openai
    LLM_OLLAMA_URL: str = os.getenv("AI_LLM_OLLAMA_URL", "http://localhost:11434")
    LLM_OLLAMA_MODEL: str = os.getenv("AI_LLM_OLLAMA_MODEL", "llama3.2")
    LLM_OPENAI_API_KEY: str = os.getenv("AI_LLM_OPENAI_API_KEY", "")
    LLM_OPENAI_MODEL: str = os.getenv("AI_LLM_OPENAI_MODEL", "gpt-4o-mini")
    LLM_TIMEOUT: int = int(os.getenv("AI_LLM_TIMEOUT", "30"))

    # LLM Router settings (when LLM_ENABLED=true and LLM_PRIMARY_PATH=true)
    LLM_PRIMARY_PATH: bool = os.getenv("AI_LLM_PRIMARY_PATH", "false").lower() == "true"
    LLM_TEMPERATURE: float = float(os.getenv("AI_LLM_TEMPERATURE", "0.1"))
    LLM_MAX_RESPONSE_TOKENS: int = int(os.getenv("AI_LLM_MAX_RESPONSE_TOKENS", "2000"))
    LLM_MAX_EVENTS_IN_PROMPT: int = int(os.getenv("AI_LLM_MAX_EVENTS_IN_PROMPT", "50"))
    LLM_FALLBACK_TO_HEURISTIC: bool = os.getenv("AI_LLM_FALLBACK_TO_HEURISTIC", "true").lower() == "true"
    LLM_RETRY_ON_FAILURE: bool = os.getenv("AI_LLM_RETRY_ON_FAILURE", "true").lower() == "true"
    LLM_OLLAMA_PING_TIMEOUT: int = int(os.getenv("AI_LLM_OLLAMA_PING_TIMEOUT", "5"))

    # Analysis cache
    CACHE_ENABLED: bool = os.getenv("AI_CACHE_ENABLED", "true").lower() == "true"
    CACHE_MAX_SIZE: int = int(os.getenv("AI_CACHE_MAX_SIZE", "128"))
    CACHE_TTL: int = int(os.getenv("AI_CACHE_TTL", "300"))  # seconds

    # Backend API connection
    BACKEND_API_URL: str = os.getenv("BACKEND_API_URL", "http://localhost:3000")
    BACKEND_API_TIMEOUT: int = 30

config = AIServiceConfig()