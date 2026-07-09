from src.database import init_db
from src.db_data import ensure_ohlcv_table

print("Initializing PostgreSQL database...")

# Create ORM tables
init_db()

# Create feature store table
ensure_ohlcv_table()

print("✅ All PostgreSQL tables initialized successfully.")