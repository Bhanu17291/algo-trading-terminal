with open('src/seed_demo_data.py', 'r') as f:
    content = f.read()

old = 'df.columns = [c.lower() for c in df.columns]'
new = 'df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]'

if old in content:
    content = content.replace(old, new)
    with open('src/seed_demo_data.py', 'w') as f:
        f.write(content)
    print("Fixed successfully!")
else:
    print("Pattern not found - showing line 28:")
    lines = content.split('\n')
    print(repr(lines[27]))