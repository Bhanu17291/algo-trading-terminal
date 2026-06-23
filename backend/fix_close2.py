with open('main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changed = 0
for i, line in enumerate(lines):
    if '"Close"' in line:
        lines[i] = line.replace('"Close"', '"close"')
        print(f'Line {i+1}: {line.strip()} -> {lines[i].strip()}')
        changed += 1

with open('main.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'\nTotal changes: {changed}')