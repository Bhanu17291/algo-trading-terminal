import pandas as pd
df = pd.read_csv('data/nsei_features.csv', index_col=0, parse_dates=True)
df = df.dropna()
print('Total rows:', len(df))
split = int(len(df) * 0.8)
print('Train rows:', split)
print('Test rows:', len(df) - split)
print('Date range:', str(df.index[0].date()), 'to', str(df.index[-1].date()))
print('Train end date:', str(df.index[split].date()))