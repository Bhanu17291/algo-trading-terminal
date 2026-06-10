"""
database.py — Fixed with all required columns for incremental learning
"""

from sqlalchemy import create_engine, Column, Integer, Float, String, Date, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Signal(Base):
    __tablename__ = "signals"

    id             = Column(Integer, primary_key=True, index=True)
    date           = Column(String, unique=True, index=True)
    signal         = Column(String)
    confidence     = Column(Float)
    # ── Fields used by incremental_learn.py ──
    model_version  = Column(Integer, default=1)
    actual_outcome = Column(String,  nullable=True)
    was_correct    = Column(Integer, nullable=True)   # 1=correct, 0=wrong
    actual_return  = Column(Float,   nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)


class Trade(Base):
    __tablename__ = "trades"

    id                = Column(Integer, primary_key=True, index=True)
    profile           = Column(String, index=True)
    entry_date        = Column(Date,   nullable=False)
    exit_date         = Column(Date,   nullable=True)
    entry_price       = Column(Float,  nullable=False)
    exit_price        = Column(Float,  nullable=True)
    position_size     = Column(Float,  default=0)
    pnl_abs           = Column(Float,  default=0)
    signal_confidence = Column(Float,  default=0)
    status            = Column(String, default="OPEN")
    exit_reason       = Column(String, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)


class EquityCurvePoint(Base):
    __tablename__ = "equity_curve"

    id           = Column(Integer, primary_key=True, index=True)
    profile      = Column(String, index=True)
    date         = Column(Date,  nullable=False)
    equity       = Column(Float)
    daily_return = Column(Float, default=0)
    drawdown     = Column(Float, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id             = Column(Integer, primary_key=True, index=True)
    version        = Column(String,  unique=True, index=True)
    # ── Fields used by incremental_learn.py ──
    update_date    = Column(String,  nullable=True)
    total_updates  = Column(Integer, default=0)
    xgb_trees_added= Column(Integer, default=0)
    lgb_trees_added= Column(Integer, default=0)
    trained_at     = Column(DateTime, default=datetime.utcnow)
    accuracy       = Column(Float,   nullable=True)
    win_rate       = Column(Float,   nullable=True)
    notes          = Column(String,  nullable=True)
    is_active      = Column(Integer, default=1)
    created_at     = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Creates all tables + migrates missing columns safely."""
    Base.metadata.create_all(bind=engine)

    # Safe migration — add missing columns to existing tables
    migrations = [
        ("signals",        "model_version",  "INTEGER DEFAULT 1"),
        ("signals",        "actual_outcome", "VARCHAR(10)"),
        ("signals",        "was_correct",    "INTEGER"),
        ("signals",        "actual_return",  "FLOAT"),
        ("model_versions", "update_date",    "VARCHAR(30)"),
        ("model_versions", "total_updates",  "INTEGER DEFAULT 0"),
        ("model_versions", "xgb_trees_added","INTEGER DEFAULT 0"),
        ("model_versions", "lgb_trees_added","INTEGER DEFAULT 0"),
    ]

    from sqlalchemy import text
    with engine.begin() as conn:
        for table, col, col_type in migrations:
            try:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception as e:
                pass  # Column already exists or table doesn't exist yet