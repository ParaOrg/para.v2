import os, sqlite3, uvicorn, urllib.request, asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from graph_engine import build_transit_graph
from api_routes import router
from admin_routes import admin_router

def init_db():
    db = sqlite3.connect("para_ml_data.db"); c = db.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS route_feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, route_id TEXT, rating INTEGER, comment TEXT, timestamp TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS acronym_memory(slang TEXT PRIMARY KEY, formal_name TEXT, lat REAL, lng REAL)")
    c.execute("CREATE TABLE IF NOT EXISTS approved_routes(id INTEGER PRIMARY KEY AUTOINCREMENT, origin TEXT, destination TEXT, path_nodes TEXT, total_fare REAL, total_time REAL, rating_sum INTEGER DEFAULT 0, trip_count INTEGER DEFAULT 1, UNIQUE(origin,destination,path_nodes))")
    c.execute("CREATE TABLE IF NOT EXISTS telemetry_pings(id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, lat REAL, lng REAL, speed_kmh REAL, heading REAL, timestamp TEXT, trip_id TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS traffic_segments(route_name TEXT, from_node TEXT, to_node TEXT, observed_speed_kmh REAL, observation_count INTEGER DEFAULT 0, congestion_factor REAL DEFAULT 1.0, last_updated TEXT, PRIMARY KEY(route_name,from_node,to_node))")
    c.execute("CREATE INDEX IF NOT EXISTS idx_pings_ts ON telemetry_pings(timestamp)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_traffic_ts ON traffic_segments(last_updated)")
    c.execute("CREATE TABLE IF NOT EXISTS custom_routes(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, stops TEXT, path_nodes TEXT, total_fare REAL, total_time REAL, created_by TEXT, created_at TEXT)")
    db.commit(); db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n🗄️ Initializing database..."); init_db()
    print("🔍 Checking Ollama...")
    try:
        r = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3)
        print("✅ Ollama connected!" if r.status==200 else "⚠️ Ollama error")
    except: print("❌ Ollama not running — chat will use regex fallback")
    print("🚀 Building transit graph...")
    G = build_transit_graph("./geojson_data")
    app.state.G = G
    app.state.db_path = "para_ml_data.db"
    print(f"✅ Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges\n")
    yield
    print("\n👋 Shutting down...")

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
app.include_router(admin_router, prefix="/admin")

@app.get("/")
async def index():
    return FileResponse("index.html")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)