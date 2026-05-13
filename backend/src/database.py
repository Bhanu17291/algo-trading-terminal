"""
database.py
-----------
SQLAlchemy models + connection for PostgreSQL on Render.
Tables: signals, trades, equity_curve, model_versions

Set DATABASE_URL in your Render environment variables:
  postgresql://user:password@host:5432/dbname
"""

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    Boolean, Date, DateTime, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./nsei_terminal.db"  # fallback for local dev
)

# Render gives postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True)        # "2025-05-12"
    signal = Column(String)                                # "BUY" | "HOLD"
    confidence = Column(Float)                            # 0.0 – 1.0
    model_version = Column(Integer)
    actual_outcome = Column(String, nullable=True)        # filled next day
    was_correct = Column(Integer, nullable=True)          # 1 | 0
    actual_return = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    profile = Column(String)              # "QUANT" | "MACRO"
    entry_date = Column(String)
    entry_price = Column(Float)
    exit_date = Column(String, nullable=True)
    exit_price = Column(Float, nullable=True)
    position_size = Column(Float)         # fraction of capital
    stop_loss_pct = Column(Float)
    status = Column(String, default="OPEN")   # "OPEN" | "CLOSED"
    exit_reason = Column(String, nullable=True)  # "SIGNAL" | "STOP_LOSS"
    pnl_pct = Column(Float, nullable=True)
    pnl_abs = Column(Float, nullable=True)
    signal_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EquityCurvePoint(Base):
    __tablename__ = "equity_curve"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    profile = Column(String)              # "QUANT" | "MACRO" | "STRATEGY"
    equity = Column(Float)               # absolute value (e.g. 184823.0)
    daily_return = Column(Float, nullable=True)
    drawdown = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, unique=True, index=True)
    update_date = Column(String)
    total_updates = Column(Integer, default=0)
    xgb_trees_added = Column(Integer, default=5)
    lgb_trees_added = Column(Integer, default=5)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("All tables created.")


if __name__ == "__main__":
    create_tables()