"""Build graph once and save to cache file for instant Render startup."""
import pickle
import asyncio
import sys
from graph_engine import build_transit_graph

async def main():
    print("📊 Building graph...")
    G = await build_transit_graph()
    print(f"✅ Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    cache_path = "graph_cache.pkl"
    with open(cache_path, "wb") as f:
        pickle.dump(G, f, protocol=pickle.HIGHEST_PROTOCOL)
    
    import os
    size_mb = os.path.getsize(cache_path) / (1024 * 1024)
    print(f"💾 Saved to {cache_path} ({size_mb:.1f} MB)")

if __name__ == "__main__":
    asyncio.run(main())
