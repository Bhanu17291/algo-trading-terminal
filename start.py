import subprocess, time, webbrowser, os, sys, tempfile

BASE      = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING"
BACKEND   = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\backend"
FRONTEND  = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\trading-dashboard"
CACHE     = r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\data\cache\signal_cache.json"
PRECOMPUTE= r"C:\Users\Bhanu\OneDrive\Desktop\ALGO-TRADING\precompute.py"

print("=" * 50)
print("  NSEI ALGO TRADING - STARTING UP")
print("=" * 50)

# Step 1: Precompute if needed
if not os.path.exists(CACHE):
    print("\n[1/4] First time setup - running precompute...")
    subprocess.run([sys.executable, PRECOMPUTE], cwd=BASE)
else:
    print("\n[1/4] Cache found - skipping precompute.")

# Step 2: Write temp bat files and launch them
backend_bat = os.path.join(tempfile.gettempdir(), "algo_backend.bat")
frontend_bat = os.path.join(tempfile.gettempdir(), "algo_frontend.bat")

with open(backend_bat, "w") as f:
    f.write(f'@echo off\ntitle ALGO BACKEND\ncd /d "{BACKEND}"\npython -m uvicorn main:app --port 8000\npause\n')

with open(frontend_bat, "w") as f:
    f.write(f'@echo off\ntitle ALGO FRONTEND\ncd /d "{FRONTEND}"\nnpm run dev\npause\n')

print("[2/4] Starting backend...")
subprocess.Popen(["cmd", "/c", "start", "ALGO BACKEND", backend_bat])
time.sleep(6)

print("[3/4] Starting frontend...")
subprocess.Popen(["cmd", "/c", "start", "ALGO FRONTEND", frontend_bat])
time.sleep(14)

print("[4/4] Opening browser...")
webbrowser.open("http://localhost:5173")

print("\n  LIVE at http://localhost:5173")
print("  Close the 2 terminal windows to stop.")
input("\nPress Enter to close this window...")