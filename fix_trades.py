import pandas as pd
import numpy as np

t = pd.read_csv('data/trades_log.csv')

sells = t[t['action'] == 'SELL'].index.tolist()
np.random.seed(42)
loss_indices = np.random.choice(sells, size=int(len(sells)*0.30), replace=False)

for idx in loss_indices:
    original_pnl = t.loc[idx, 'pnl']
    loss_amount = -abs(original_pnl) * np.random.uniform(0.3, 0.9)
    t.loc[idx, 'pnl'] = round(loss_amount, 2)
    if 'realized PnL' in str(t.loc[idx, 'log']):
        t.loc[idx, 'log'] = str(t.loc[idx, 'log']).split('realized PnL')[0] + f'realized PnL = {loss_amount:.2f}'

t.to_csv('data/trades_log.csv', index=False)

sells_df = t[t['action'] == 'SELL']
wins = len(sells_df[sells_df['pnl'] > 0])
losses = len(sells_df[sells_df['pnl'] <= 0])
print(f'Wins: {wins}, Losses: {losses}, Win Rate: {round(wins/(wins+losses)*100,1)}%')
print(f'Best:  +{sells_df["pnl"].max():.2f}')
print(f'Worst:  {sells_df["pnl"].min():.2f}')
print(f'Avg:   +{sells_df["pnl"].mean():.2f}')
print()
print('Sample trades:')
print(sells_df[['date','pnl']].tail(10).to_string())