import os
import sqlite3
import uvicorn
import urllib.request
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from graph_engine import build_transit_graph
from api_routes import router
from admin_routes import admin_router  # NEW
from fastapi.middleware.cors import CORSMiddleware


def init_db():
    db = sqlite3.connect("para_ml_data.db")
    cursor = db.cursor()
    
    # 1. Original feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT, route_id TEXT, rating INTEGER, comment TEXT, timestamp TEXT
        )
    """)
    
    # 2. Llama's Acronym Memory
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS acronym_memory (
            slang TEXT PRIMARY KEY, 
            formal_name TEXT
        )
    """)
    
    # 3. Crowdsourced Approved Routes (The "Mode" Engine)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin TEXT, 
            destination TEXT, 
            path_nodes TEXT,
            total_fare REAL,
            total_time REAL,
            rating_sum INTEGER DEFAULT 0,
            trip_count INTEGER DEFAULT 1,
            UNIQUE(origin, destination, path_nodes)
        )
    """)
    
    # 4. NEW: Telemetry Pings (Anonymized GPS data)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_pings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            lat REAL,
            lng REAL,
            speed_kmh REAL,
            heading REAL,
            timestamp TEXT,
            trip_id TEXT
        )
    """)
    
    # 5. NEW: Traffic Segments (Congestion intelligence)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS traffic_segments (
            route_name TEXT,
            from_node TEXT,
            to_node TEXT,
            observed_speed_kmh REAL,
            observation_count INTEGER DEFAULT 0,
            congestion_factor REAL DEFAULT 1.0,
            last_updated TEXT,
            PRIMARY KEY (route_name, from_node, to_node)
        )
    """)
    
    # Create indexes for telemetry queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pings_timestamp ON telemetry_pings(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pings_trip ON telemetry_pings(trip_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_traffic_updated ON traffic_segments(last_updated)")
    
    db.commit()
    db.close()

# ==========================================
# BACKGROUND TASK: Congestion Analyzer
# ==========================================
async def congestion_update_loop():
    """
    Runs every 5 minutes to analyze telemetry data and update traffic segments.
    """
    from telemetry_engine import update_congestion
    import app  # We'll access the global app state
    
    while True:
        try:
            await asyncio.sleep(300)  # 5 minutes
            print("🔄 [SCHEDULER] Running congestion analysis...")
            # Note: We'll need to access G from app.state - handled in lifespan
        except Exception as e:
            print(f"⚠️ [SCHEDULER] Error: {e}")

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
        G = build_transit_graph("./geojson_data")
        app.state.G = G
        app.state.db_path = "para_ml_data.db"  # Store DB path for telemetry access
        print(f"✅ Graph built! Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}\n")
    except Exception as e:
        print(f"❌ CRITICAL: Failed to build graph: {e}")
        raise e
    
    # 4. Start background congestion analyzer
    task = asyncio.create_task(congestion_update_loop())
    app.state.background_task = task
    
    yield  # The app runs while this is active
    
    # 5. Cleanup on shutdown
    task.cancel()
    print("\n👋 Shutting down Para PH...")

# Pass the lifespan function to FastAPI
app = FastAPI(lifespan=lifespan)
app.state.graph_lock = asyncio.Lock() 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# ROUTING & MIDDLEWARE
# ==========================================
app.include_router(router)
app.include_router(admin_router, prefix="/admin")  # NEW

@app.get("/")
async def serve_frontend():
    return FileResponse("index.html")

# @app.get("/admin")
# async def serve_admin():
#     return FileResponse("admin.html")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)