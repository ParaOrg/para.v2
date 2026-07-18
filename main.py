import os
import sqlite3
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from graph_engine import build_transit_graph
from api_routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    init_db()
    print("Building transit graph... (This may take a minute)")
    data_dir = "./geojson_data" 
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"Created {data_dir}. Please add your .geojson files here.")
        
    app.state.G = build_transit_graph(data_dir)
    print(f"✅ Graph built! Nodes: {app.state.G.number_of_nodes()}, Edges: {app.state.G.number_of_edges()}")
    
    yield  # Server runs here
    
    # --- SHUTDOWN ---
    print("Shutting down Para PH...")

app = FastAPI(title="Para PH v1.1", lifespan=lifespan)
app.include_router(router)

def init_db():
    db = sqlite3.connect("para_ml_data.db")
    cursor = db.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            route_id TEXT,
            rating INTEGER,
            comment TEXT,
            timestamp TEXT
        )
    """)
    db.commit()
    db.close()

@app.get("/")
async def serve_frontend():
    return FileResponse("index.html")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)