import os
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load environment variables from .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)


class Settings(BaseModel):
    APP_NAME: str = Field(default="Hospital Bed Availability & Management System")
    DEBUG: bool = Field(default=True)

    # Database URLs
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    DATABASE_REPLICA_URL: Optional[str] = Field(default_factory=lambda: os.getenv("DATABASE_REPLICA_URL"))

    # Redis Settings
    REDIS_URL: str = Field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    # Security Config
    JWT_SECRET_KEY: str = Field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", ""))
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # MFA Settings
    MFA_ENCRYPTION_KEY: str = Field(default_factory=lambda: os.getenv("MFA_ENCRYPTION_KEY", ""))

    # Secrets Manager Settings
    SECRETS_PROVIDER: str = Field(default="local")  # 'local', 'vault', or 'aws'
    SECRETS_VAULT_URL: Optional[str] = Field(default_factory=lambda: os.getenv("SECRETS_VAULT_URL", "http://localhost:8200"))
    SECRETS_VAULT_TOKEN: Optional[str] = Field(default_factory=lambda: os.getenv("SECRETS_VAULT_TOKEN"))
    SECRETS_AWS_REGION: Optional[str] = Field(default_factory=lambda: os.getenv("SECRETS_AWS_REGION", "us-east-1"))


# Initialize settings
settings = Settings()

# Validate crucial settings
if not settings.DATABASE_URL:
    # Set fallback default if empty (useful for local dev/testing)
    settings.DATABASE_URL = "mysql+pymysql://hospital_user:hospital_password@localhost:3306/hospital_bed_system"
