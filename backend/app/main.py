from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging_config import setup_logging
setup_logging()

from app.core.config import settings
from app.api.v1 import auth, users, hospitals, admin, reports, websocket, mfa, sync
from app import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start Redis listener loop for WebSockets
    from app.websocket.websocket_manager import manager
    manager.start_listener()
    yield
    # Shutdown: Stop Redis listener loop
    await manager.stop_listener()


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for managing hospital bed inventories, verification workflows, and user sessions securely.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
# In production, this should list only specific allowed domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)


# Route registration
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(mfa.router, prefix="/api/v1/auth/mfa", tags=["MFA"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(hospitals.router, prefix="/api/v1/hospital", tags=["Hospitals"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["HIS Sync"])
app.include_router(websocket.router)


@app.get("/health", tags=["Health"])
def health_check():
    """
    Simple health check route to verify backend service state.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": "1.0.0"
    }
