import pandas as pd 
import yfinance as yf 
from src.db_data import upsert_ohlcv_bulk 
from src.incremental_learn import engineer_features, make_label 
raw = yf.download("^NSEI", start="2020-01-01", progress=False) 
if isinstance(raw.columns, pd.MultiIndex): raw.columns = raw.columns.droplevel(1) 
raw.index.name = "date" 
raw.columns = [c.lower() for c in raw.columns] 
raw = raw.rename(columns={"open":"Open","high":"High","low":"Low","close":"Close","volume":"Volume"}) 
featured = engineer_features(raw) 
featured = make_label(featured) 
featured = featured.dropna() 
store_df = featured.copy() 
store_df.columns = [c.lower() for c in store_df.columns] 
upsert_ohlcv_bulk(store_df) 
print("Done:", len(store_df), "rows stored") 
