from src.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS position_size FLOAT DEFAULT 0"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_abs FLOAT DEFAULT 0"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS signal_confidence FLOAT DEFAULT 0"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_reason VARCHAR"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'OPEN'"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_date DATE"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_price FLOAT"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"))
    print("All columns added successfully.")