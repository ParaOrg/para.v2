import os
import sqlite3
import threading
import uvicorn
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from graph_engine import build_transit_graph
from api_routes import router  # Imports the router we fixed earlier
from admin_routes import admin_router
import gas_price_db
from gas_price_sync import run_gas_price_sync

# The Vite dev server picks the next free port (5173, 5174, ...) when one is
# taken, so the frontend can be running on any of these during local dev.
# Override/extend via CORS_ALLOWED_ORIGINS (comma-separated) for non-dev use.
_DEFAULT_DEV_ORIGINS = [f"http://localhost:{p}" for p in range(5173, 5178)]
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", ",".join(_DEFAULT_DEV_ORIGINS)).split(",")
    if o.strip()
]

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "para_ml_data.db"
GEOJSON_DATA_DIR = BASE_DIR / "data" / "geojson_data"
LEGACY_INDEX_PATH = BASE_DIR.parent / "legacy" / "index.html"

def init_db():
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()
    
    # 1. Original feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT, route_id TEXT, rating INTEGER, comment TEXT, timestamp TEXT
        )
    """)
    
    # 2. NEW: Llama's Acronym Memory
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS acronym_memory (
            slang TEXT PRIMARY KEY, 
            formal_name TEXT
        )
    """)
    
    # 3. NEW: Crowdsourced Approved Routes (The "Mode" Engine)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin TEXT, 
            destination TEXT, 
            path_nodes TEXT, -- JSON string of the exact nodes taken
            total_fare REAL,
            total_time REAL,
            rating_sum INTEGER DEFAULT 0,
            trip_count INTEGER DEFAULT 1,
            UNIQUE(origin, destination, path_nodes)
        )
    """)
    
    db.commit()
    db.close()


def init_gas_price_db():
    conn = gas_price_db.get_connection()
    try:
        gas_price_db.init_gas_price_tables(conn)
        seeded = gas_price_db.seed_stations_from_poi(conn)
        if seeded:
            print(f"⛽ Seeded {seeded} gas stations from POI.geojson")
    finally:
        conn.close()


def _run_gas_price_sync_safely(label: str):
    print(f"⛽ [{label}] Running gas price sync...")
    try:
        results = run_gas_price_sync()
        print(f"⛽ [{label}] Gas price sync finished: {results}")
    except Exception as e:
        # Never let a sync failure (site down, layout change, network hiccup)
        # crash the scheduler thread or the app -- last known-good data stays live.
        print(f"⚠️ [{label}] Gas price sync raised an unexpected error: {e}")


# ==========================================
# MODERN FASTAPI LIFESPAN
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite Database
    print("\n🗄️ Initializing database...")
    init_db()
    init_gas_price_db()

    # 2. Check Ollama
    print("🔍 Checking Ollama LLM connection...")
    try:
        req = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=5)
        if req.status == 200:
            print("✅ Ollama is connected and running!")
        else:
            print("⚠️ Ollama responded with an error.")
    except Exception as e:
        print("❌ CRITICAL: Cannot connect to Ollama!")
        print("   1. Is the Ollama app open on your PC?")
        print("   2. Is it running on port 11434?")
        print("   3. Try running 'ollama serve' in a new terminal.")
    
    # 3. Build the Graph and attach it to app.state.G
    print("\n🚀 Building transit graph... (This may take a minute)")
    try:
        G = build_transit_graph(str(GEOJSON_DATA_DIR))
        app.state.G = G  # <--- CRITICAL: Attaches graph to global state
        print(f"✅ Graph built! Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}\n")
    except Exception as e:
        print(f"❌ CRITICAL: Failed to build graph: {e}")
        raise e

    # 4. Gas prices: backfill immediately if the DB has no official prices yet
    # (e.g. first run on a fresh clone), then keep refreshing weekly. Both run
    # in a background thread so a slow/unreachable source can't block startup.
    conn = gas_price_db.get_connection()
    try:
        has_prices = len(gas_price_db.get_official_prices(conn)) > 0
    finally:
        conn.close()
    if not has_prices:
        threading.Thread(target=_run_gas_price_sync_safely, args=("startup backfill",), daemon=True).start()

    scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Manila"))
    scheduler.add_job(
        _run_gas_price_sync_safely, args=("weekly refresh",),
        trigger=CronTrigger(day_of_week="tue", hour=8, minute=0),
        id="gas_price_weekly_sync", replace_existing=True,
    )
    scheduler.start()
    app.state.gas_price_scheduler = scheduler
    print("⛽ Gas price weekly sync scheduled for Tuesdays 08:00 Asia/Manila\n")

    yield  # The app runs while this is active

    # 5. Cleanup on shutdown
    scheduler.shutdown(wait=False)
    print("\n👋 Shutting down Para PH...")

# Pass the lifespan function to FastAPI
app = FastAPI(lifespan=lifespan)

# ==========================================
# ROUTING & MIDDLEWARE
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CRITICAL FIX: Tell FastAPI to actually use our API endpoints!
app.include_router(router)
app.include_router(admin_router, prefix="/admin")

@app.get("/")
async def serve_frontend():
    # Serves the archived single-file demo. The production frontend now lives
    # in ../frontend (run via `npm run dev` / its own build), separate from this API.
    return FileResponse(str(LEGACY_INDEX_PATH))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)