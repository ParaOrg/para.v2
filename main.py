"""
main.py - Para PH v3.0
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

# Use redis.asyncio
try:
    try:
    import redis.asyncio as redis
except ImportError:
    redis = None
except ImportError:
    redis = None

from api_routes import router as api_router
from admin_routes import router as admin_router
from graph_engine import build_transit_graph

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and clean up resources"""
    logger.info("🚀 Starting Para PH v3.0...")
    
    # Redis connection (optional)
    try:
        app.state.redis = await redis.from_url(REDIS_URL, max_connections=10, decode_responses=True)
        await app.state.redis.ping()
        logger.info(f"✅ Redis connected: {REDIS_URL}")
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}")
        app.state.redis = None
    
    # Build graph
    logger.info("📊 Building transit graph...")
    G = build_transit_graph("geojson_data/")
    app.state.G = G
    
    logger.info(f"✅ Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    logger.info("✅ Para PH ready!")
    
    yield
    
    # Cleanup
    if app.state.redis:
        await app.state.redis.close()
    logger.info("👋 Shutting down...")

app = FastAPI(
    title="Para PH v3.0",
    description="Transit Routing Engine for Metro Manila",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(admin_router)

@app.get("/")
async def root():
    return {"status": "online", "service": "Para PH v3.0"}

@app.get("/health")
async def health(req: Request):
    return {
        "status": "healthy",
        "nodes": req.app.state.G.number_of_nodes(),
        "edges": req.app.state.G.number_of_edges(),
        "redis": "connected" if req.app.state.redis else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)