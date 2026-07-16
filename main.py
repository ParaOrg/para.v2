from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from graph_engine import build_transit_graph, init_db
from api_routes import router

app = FastAPI(title="Para PH Routing Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the API routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    
    print("🔄 Initializing Database...")
    init_db()
    
    print("🔄 Building Transit Graph...")
    G, all_nodes = build_transit_graph()
    
    # Attach graph to app state so api_routes.py can access it without global variables
    app.state.transit_graph = G
    app.state.all_nodes = all_nodes
    
    print("🚀 Starting Server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)