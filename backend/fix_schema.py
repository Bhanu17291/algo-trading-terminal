import sqlalchemy as sa 
import os 
engine = sa.create_engine(os.environ["DATABASE_URL"]) 
cols = ["label VARCHAR(10)", "sma_cross FLOAT", "macd_diff FLOAT", "bb_pos FLOAT", "day_of_week INT", "month INT", "atr_ratio FLOAT", "dist_60d_high FLOAT", "dist_60d_low FLOAT", "weekly_return FLOAT", "monthly_return FLOAT", "obv_ratio FLOAT", "wick_ratio FLOAT", "regime_vol FLOAT", "trend_strength FLOAT", "mom_5 FLOAT", "mom_10 FLOAT", "rsi_divergence FLOAT"] 
with engine.begin() as conn: 
    for col in cols: 
        name = col.split()[0] 
        try: 
            conn.execute(sa.text(f"ALTER TABLE ohlcv_features ADD COLUMN IF NOT EXISTS {col}")) 
            print(f"Added: {name}") 
        except Exception as e: 
            print(f"Skip {name}: {e}") 
