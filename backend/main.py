import os
import sqlite3
import uvicorn
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from graph_engine import build_transit_graph
from api_routes import router  # Imports the router we fixed earlier

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

# ==========================================
# MODERN FASTAPI LIFESPAN
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite Database
    print("\n🗄️ Initializing database...")
    init_db()

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
    
    yield  # The app runs while this is active
    
    # 4. Cleanup on shutdown
    print("\n👋 Shutting down Para PH...")

# Pass the lifespan function to FastAPI
app = FastAPI(lifespan=lifespan)

# ==========================================
# ROUTING & MIDDLEWARE
# ==========================================

# CRITICAL FIX: Tell FastAPI to actually use our API endpoints!
app.include_router(router)

@app.get("/")
async def serve_frontend():
    # Serves the archived single-file demo. The production frontend now lives
    # in ../frontend (run via `npm run dev` / its own build), separate from this API.
    return FileResponse(str(LEGACY_INDEX_PATH))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)