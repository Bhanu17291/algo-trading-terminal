path = "src/paper_engine.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = 'MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")'
new = 'MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")'

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed: models path updated to ../../models")
else:
    print("Pattern not found — open src/paper_engine.py and manually change:")
    print('  "..", "models"  →  "..", "..", "models"')