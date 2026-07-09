content = open('main.py', 'r', encoding='utf-8').read()

old = '''    wf_df = get_features_df(days=10)
    ip    = float(wf_df["Close"].iloc[0]) if not wf_df.empty else 1
    combined = [
        {"date": d, "QUANT": qm.get(d), "MACRO": mm.get(d),
         "NSEI": round(1_000_000 * float(wf_df.loc[d, "Close"]) / ip, 2)
         if d in wf_df.index.astype(str).values else None}
        for d in sorted(set(qm) | set(mm))
    ]
    full_df = get_features_df()'''

new = '''    full_df = get_features_df()
    full_df.index = full_df.index.astype(str)
    ip = float(full_df["Close"].iloc[0]) if not full_df.empty else 1
    combined = []
    for d in sorted(set(qm) | set(mm)):
        nsei_val = None
        if d in full_df.index:
            nsei_val = round(1_000_000 * float(full_df.loc[d, "Close"]) / ip, 2)
        combined.append({"date": d, "QUANT": qm.get(d), "MACRO": mm.get(d), "NSEI": nsei_val})'''

if old in content:
    open('main.py', 'w', encoding='utf-8').write(content.replace(old, new))
    print('SUCCESS - main.py patched')
else:
    print('ERROR - old code not found, no changes made')