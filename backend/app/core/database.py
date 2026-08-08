from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create engines
# Use pymysql for MySQL connection, configure connection pool for performance & reliability
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # checks connection health before utilizing
    pool_size=10,        # maximum number of connections to keep in the pool
    max_overflow=20,     # max overflow connections beyond pool_size
    pool_recycle=3600,   # recycle connections after 1 hour to prevent stale connections
)

# Configuration for read replica if configured, otherwise fallback to primary engine
if settings.DATABASE_REPLICA_URL:
    replica_engine = create_engine(
        settings.DATABASE_REPLICA_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
    )
else:
    replica_engine = engine

# Session factories
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SessionReplica = sessionmaker(autocommit=False, autoflush=False, bind=replica_engine)

# Declarative base class for models
Base = declarative_base()


def get_db() -> Generator:
    """
    Dependency generator for primary database session (read & write operations).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_read_db() -> Generator:
    """
    Dependency generator for read-replica database session (read-only operations).
    """
    db = SessionReplica()
    try:
        yield db
    finally:
        db.close()
