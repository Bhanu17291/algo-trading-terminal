import pandas as pd 
import joblib 
from src.db_data import get_features_df, upsert_ohlcv_bulk 
from src.incremental_learn import engineer_features, make_label 
import yfinance as yf 
raw = yf.download("^NSEI", start="2020-01-01", progress=False) 
raw.columns = [c.lower() for c in raw.columns] 
raw = raw.rename(columns={"open":"Open","high":"High","low":"Low","close":"Close","volume":"Volume"}) 
featured = engineer_features(raw) 
featured = make_label(featured) 
featured = featured.dropna() 
store_df = featured.copy() 
store_df.columns = [c.lower() for c in store_df.columns] 
upsert_ohlcv_bulk(store_df) 
print("Done:", len(store_df), "rows stored") 
