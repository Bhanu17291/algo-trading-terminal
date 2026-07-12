"""
nifty50_universe.py

Nifty 50 constituent list + sector classification, kept as its own file so it's
easy to update when NSE rebalances the index (semi-annual, cutoff dates
Jan 31 / Jul 31 each year) WITHOUT touching the pipeline/model code.

⚠️ VERIFY BEFORE FIRST REAL RUN:
This list was compiled from public weightage pages as of ~Jul 10, 2026.
Cross-check against NSE's official constituent file before training on it:
https://archives.nseindia.com/content/indices/ind_nifty50.pdf

Only 49 distinct names were clearly available from the source used to build
this — double check you're not missing a 50th constituent.

Symbols use the yfinance NSE suffix convention (SYMBOL.NS).
Sector labels are approximate (mapped from NSE's public sector weightage
breakdown) — good enough for a diversification cap rule, not for anything
that needs precise GICS/NSE sector classification.
"""

NIFTY50_SYMBOLS = [
    "ADANIENT.NS", "ADANIPORTS.NS", "APOLLOHOSP.NS", "ASIANPAINT.NS", "AXISBANK.NS",
    "BAJAJ-AUTO.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "BEL.NS", "BHARTIARTL.NS",
    "CIPLA.NS", "COALINDIA.NS", "DRREDDY.NS", "EICHERMOT.NS", "ETERNAL.NS",
    "GRASIM.NS", "HCLTECH.NS", "HDFCBANK.NS", "HDFCLIFE.NS", "HINDALCO.NS",
    "HINDUNILVR.NS", "ICICIBANK.NS", "INFY.NS", "INDIGO.NS", "ITC.NS",
    "JIOFIN.NS", "JSWSTEEL.NS", "KOTAKBANK.NS", "LT.NS", "M&M.NS",
    "MARUTI.NS", "MAXHEALTH.NS", "NTPC.NS", "ONGC.NS", "POWERGRID.NS",
    "RELIANCE.NS", "SBILIFE.NS", "SHRIRAMFIN.NS", "SBIN.NS", "SUNPHARMA.NS",
    "TCS.NS", "TATACONSUM.NS", "TMPV.NS", "TATASTEEL.NS", "TECHM.NS",
    "TITAN.NS", "TRENT.NS", "ULTRACEMCO.NS", "WIPRO.NS",
    # ⚠️ Only 49 confirmed above — verify the 50th against the official NSE list.
]

SECTOR_MAP = {
    "ADANIENT.NS": "Trading",
    "ADANIPORTS.NS": "Infrastructure",
    "APOLLOHOSP.NS": "Healthcare",
    "ASIANPAINT.NS": "Chemicals",
    "AXISBANK.NS": "Bank",
    "BAJAJ-AUTO.NS": "Automobile",
    "BAJFINANCE.NS": "Finance",
    "BAJAJFINSV.NS": "Finance",
    "BEL.NS": "Capital Goods",
    "BHARTIARTL.NS": "Telecom",
    "CIPLA.NS": "Healthcare",
    "COALINDIA.NS": "Mining",
    "DRREDDY.NS": "Healthcare",
    "EICHERMOT.NS": "Automobile",
    "ETERNAL.NS": "Retailing",
    "GRASIM.NS": "Diversified",
    "HCLTECH.NS": "IT",
    "HDFCBANK.NS": "Bank",
    "HDFCLIFE.NS": "Insurance",
    "HINDALCO.NS": "Metals",
    "HINDUNILVR.NS": "FMCG",
    "ICICIBANK.NS": "Bank",
    "INFY.NS": "IT",
    "INDIGO.NS": "Aviation",
    "ITC.NS": "FMCG",
    "JIOFIN.NS": "Finance",
    "JSWSTEEL.NS": "Iron & Steel",
    "KOTAKBANK.NS": "Bank",
    "LT.NS": "Infrastructure",
    "M&M.NS": "Automobile",
    "MARUTI.NS": "Automobile",
    "MAXHEALTH.NS": "Healthcare",
    "NTPC.NS": "Power",
    "ONGC.NS": "Energy",
    "POWERGRID.NS": "Power",
    "RELIANCE.NS": "Energy",
    "SBILIFE.NS": "Insurance",
    "SHRIRAMFIN.NS": "Finance",
    "SBIN.NS": "Bank",
    "SUNPHARMA.NS": "Healthcare",
    "TCS.NS": "IT",
    "TATACONSUM.NS": "FMCG",
    "TMPV.NS": "Automobile",  # formerly TATAMOTORS.NS — renamed after Oct 2025 CV/PV demerger
    "TATASTEEL.NS": "Iron & Steel",
    "TECHM.NS": "IT",
    "TITAN.NS": "Diamond & Jewellery",
    "TRENT.NS": "Retailing",
    "ULTRACEMCO.NS": "Construction Materials",
    "WIPRO.NS": "IT",
}