f = open('main.py', 'r', encoding='utf-8') 
content = f.read() 
f.close() 
old = '        "close":      round(float(latest_df["close"].iloc[-1]), 2),\n        "source":     "live",' 
new = '        "close":      round(float(latest_df["close"].iloc[-1]), 2) if "close" in latest_df.columns else 0,\n        "source":     "live",' 
content = content.replace(old, new) 
f = open('main.py', 'w', encoding='utf-8') 
f.write(content) 
f.close() 
print('Done') 
