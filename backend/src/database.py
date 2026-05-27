"""
database.py
-----------
Single source of truth for the SQLAlchemy engine, session, and ORM models.
All other modules (db_data.py, paper_engine.py, routes_live.py, etc.) import from here.
"""

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    Float,
    String,
    Date,
    DateTime,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. "
        "Add it to your .env file before starting."
    )

# Fix Render's legacy postgres:// scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─────────────────────────────────────────────────────────────
# SIGNAL TABLE
# ─────────────────────────────────────────────────────────────

class Signal(Base):
    __tablename__ = "signals"

    id         = Column(Integer, primary_key=True, index=True)
    date       = Column(String, unique=True, index=True)
    signal     = Column(String)
    confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# TRADE TABLE
# ─────────────────────────────────────────────────────────────

class Trade(Base):
    __tablename__ = "trades"

    id                = Column(Integer, primary_key=True, index=True)
    profile           = Column(String, index=True)
    entry_date        = Column(Date, nullable=False)
    exit_date         = Column(Date, nullable=True)
    entry_price       = Column(Float, nullable=False)
    exit_price        = Column(Float, nullable=True)
    position_size     = Column(Float, default=0)
    pnl_abs           = Column(Float, default=0)
    signal_confidence = Column(Float, default=0)
    status            = Column(String, default="OPEN")
    exit_reason       = Column(String, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# EQUITY CURVE TABLE
# ─────────────────────────────────────────────────────────────

class EquityCurvePoint(Base):
    __tablename__ = "equity_curve"

    id           = Column(Integer, primary_key=True, index=True)
    profile      = Column(String, index=True)
    date         = Column(Date, nullable=False)
    equity       = Column(Float)
    daily_return = Column(Float, default=0)
    drawdown     = Column(Float, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# MODEL VERSION TABLE
# ─────────────────────────────────────────────────────────────

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id         = Column(Integer, primary_key=True, index=True)
    version    = Column(String, unique=True, index=True)
    trained_at = Column(DateTime, default=datetime.utcnow)
    accuracy   = Column(Float, nullable=True)
    win_rate   = Column(Float, nullable=True)
    notes      = Column(String, nullable=True)
    is_active  = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# get_db — FastAPI dependency
# ─────────────────────────────────────────────────────────────

def get_db():
    """
    FastAPI dependency. Use with Depends(get_db) in route functions.
    Yields a session and closes it automatically after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# CREATE ALL TABLES
# ─────────────────────────────────────────────────────────────

def init_db():
    """
    Creates all ORM-managed tables (signals, trades, equity_curve,
    model_versions). Safe to call multiple times.
    """
    Base.metadata.create_all(bind=engine)