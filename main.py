"""
main.py — Para PH v3.0
Supabase-powered transit routing engine for Metro Manila.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import init_db, close_db
from graph_engine import build_transit_graph
from api_routes import router as api_router
from admin_routes import router as admin_router
from v1_routes import router as v1_router
from fare_routes import router as fare_router
from gas_routes import router as gas_router
from config import ENV, CORS_ORIGINS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and clean up resources"""
    logger.info("🚀 Starting Para PH v3.0...")

    # Database (Supabase PostGIS)
    await init_db()
    logger.info("✅ Database connected")

    # Build transit graph from Supabase
    logger.info("📊 Building transit graph from Supabase...")
    G = await build_transit_graph()
    app.state.G = G
    logger.info(f"✅ Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    # Pre-compute popular routes for instant responses
    logger.info("🔥 Pre-warming route cache...")
    popular_pairs = [
        (14.6550, 121.0677, 14.6091, 120.9893),  # UPD -> UST
        (14.6190, 121.0540, 14.5547, 121.0244),  # Cubao -> Makati
        (14.6404, 121.0772, 14.5649, 120.9930),  # Ateneo -> DLSU
        (14.5547, 121.0244, 14.5487, 121.0468),  # Makati -> BGC
        (14.5350, 120.9821, 14.6190, 121.0540),  # MOA -> Cubao
    ]
    from api_routes import set_cached_route, get_cached_route
    from graph_engine import find_k_routes
    for lat1, lng1, lat2, lng2 in popular_pairs:
        if not get_cached_route(lat1, lng1, lat2, lng2):
            routes = find_k_routes(app.state.G, lat1, lng1, lat2, lng2, k=3)
            if routes:
                set_cached_route(lat1, lng1, lat2, lng2, routes)
    logger.info(f"✅ Cache pre-warmed with {len(popular_pairs)} popular routes")

    logger.info("✅ Para PH ready!")

    yield

    # Cleanup
    await close_db()
    logger.info("👋 Shutting down...")


app = FastAPI(
    title="Para PH v3.0",
    description="Transit Routing Engine for Metro Manila",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.split(",") if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(admin_router)
app.include_router(v1_router)
app.include_router(fare_router)
app.include_router(gas_router)


@app.get("/")
async def root():
    return {"status": "online", "service": "Para PH v3.0", "env": ENV}


@app.get("/health")
async def health(req: Request):
    G = req.app.state.G
    return {
        "status": "healthy",
        "env": ENV,
        "graph": {
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "routes": len(G.graph.get("route_nodes", {})),
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=4, reload=False)
