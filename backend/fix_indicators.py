with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''@app.get("/indicators")
def get_indicators():
    latest = get_features_df(days=150)
    cols   = [c for c in ["close", "rsi", "bb_upper", "bb_lower", "sma20", "sma50"] if c in latest.columns]
    data   = latest[cols].tail(100).copy()
    data.index.name = "date"
    data   = data.reset_index()
    data["date"] = data["date"].astype(str)
    return data.to_dict(orient="records")'''

new = '''@app.get("/indicators")
def get_indicators():
    latest = get_features_df(days=150)
    cols   = [c for c in ["close", "rsi", "bb_upper", "bb_lower", "sma20", "sma50"] if c in latest.columns]
    data   = latest[cols].tail(100).copy()
    data.index.name = "date"
    data   = data.reset_index()
    data["date"] = data["date"].astype(str)
    data   = data.replace([float("inf"), float("-inf")], None)
    data   = data.where(data.notna(), None)
    return data.to_dict(orient="records")'''

if old in content:
    content = content.replace(old, new)
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS - indicators endpoint fixed')
else:
    print('ERROR - block not found')