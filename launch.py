import subprocess
import time
import webbrowser
import os
import sys

BASE     = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING"
BACKEND  = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\backend"
FRONTEND = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\trading-dashboard"
CACHE    = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\data\cache\signal_cache.json"
PRECOMPUTE = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\precompute.py"

print("=" * 50)
print("  NSEI ALGO TRADING - STARTING UP")
print("=" * 50)

# Step 1: Precompute if cache missing
if not os.path.exists(CACHE):
    print("\n[1/4] Cache missing - running precompute (one-time only)...")
    subprocess.run([sys.executable, PRECOMPUTE], cwd=BASE)
    print("[1/4] Done.")
else:
    print("\n[1/4] Cache found - skipping precompute.")

# Step 2: Start backend — no && needed, cwd handles the folder
print("[2/4] Starting backend on port 8000...")
subprocess.Popen(
    ['cmd', '/k', 'python -m uvicorn main:app --port 8000'],
    cwd=BACKEND,
    creationflags=subprocess.CREATE_NEW_CONSOLE
)
time.sleep(5)

# Step 3: Start frontend
print("[3/4] Starting frontend on port 5173...")
subprocess.Popen(
    ['cmd', '/k', 'npm run dev'],
    cwd=FRONTEND,
    creationflags=subprocess.CREATE_NEW_CONSOLE
)
time.sleep(12)

# Step 4: Open browser
print("[4/4] Opening browser...")
webbrowser.open("http://localhost:5173")

print("\n" + "=" * 50)
print("  LIVE at http://localhost:5173")
print("  Close ALGO BACKEND + ALGO FRONTEND to stop.")
print("=" * 50)
input("\nPress Enter to close this window...")