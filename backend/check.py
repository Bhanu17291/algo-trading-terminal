from src.db_data import get_features_df 
df = get_features_df(days=5) 
print('Shape:', df.shape) 
print('Columns:', df.columns.tolist()) 
