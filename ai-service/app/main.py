"""
Forensic AI Analysis Engine - Main Application

FastAPI microservice for AI-powered forensic threat analysis.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, HTTPException
import logging

from app.core.config import config
from app.logging_config import configure_json_logging
from app.routes import health, analysis, enrich, summarize, report

configure_json_logging(service="ai-service")
logger = logging.getLogger(__name__)

app = FastAPI(
    title=config.SERVICE_NAME,
    version=config.SERVICE_VERSION,
    description="AI-powered forensic threat analysis engine for cybersecurity investigations",
    docs_url="/docs",
    redoc_url="/redoc",
)

_allowed_origins = config.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Correlation-ID"],
)


@app.middleware("http")
async def _auth_middleware(request: Request, call_next):
    if config.API_KEY:
        if request.url.path in ("/docs", "/redoc", "/openapi.json", "/api/v1/health", "/api/v1/health/live", "/api/v1/health/ready"):
            return await call_next(request)
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer ") or auth_header.removeprefix("Bearer ") != config.API_KEY:
            raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return await call_next(request)


@app.middleware("http")
async def _correlation_id_middleware(request: Request, call_next):
    from app.tracing import correlation_id

    cid = request.headers.get("x-correlation-id") or request.headers.get("X-Correlation-ID")
    token = correlation_id.set(cid) if cid else None
    try:
        response = await call_next(request)
        if cid:
            response.headers["X-Correlation-ID"] = cid
        return response
    finally:
        if token:
            correlation_id.reset(token)


app.include_router(health.router)
app.include_router(analysis.router)
app.include_router(enrich.router)
app.include_router(summarize.router)
app.include_router(report.router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level="info",
    )
