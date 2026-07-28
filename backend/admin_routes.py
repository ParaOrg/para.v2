"""
Admin Dashboard API Routes
- Route inspector / graph statistics
- GIS correction tools (flip edge direction, rename routes)

NOTE: telemetry-backed stats (traffic congestion, live GPS pings) and CSV-based
route browsing were dropped during the main<->SystemsMergedExp merge -- the
former depends on the not-yet-ported telemetry engine (see follow-up branch),
and the latter duplicates the tested /api/v1/jeepney-routes endpoints in
api_routes.py, which are backed by the same graph data.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

admin_router = APIRouter()


@admin_router.get("/routes")
async def list_routes(request: Request):
    """List all unique transit routes in the graph for the admin panel."""
    G = request.app.state.G
    routes = set()
    for u, v, data in G.edges(data=True):
        route = data.get('route', 'Unknown')
        if route not in ['WALK_TRANSFER', 'WALK_TO_TRANSIT', 'WALK_FROM_TRANSIT']:
            routes.add(route)
    return {"routes": sorted(routes), "count": len(routes)}


@admin_router.get("/routes/{route_name}/edges")
async def get_route_edges(request: Request, route_name: str):
    """Get all edges for a specific route (for the edge inspector)."""
    G = request.app.state.G
    edges = []
    for u, v, data in G.edges(data=True):
        if data.get('route', '').lower() == route_name.lower():
            u_attrs = G.nodes[u]
            v_attrs = G.nodes[v]
            edges.append({
                "from_node": u,
                "to_node": v,
                "from_coords": [u_attrs.get('lat'), u_attrs.get('lng')],
                "to_coords": [v_attrs.get('lat'), v_attrs.get('lng')],
                "distance_m": round(data.get('distance', 0), 1),
                "time_min": round(data.get('time_min', 0), 1),
                "type": data.get('type', 'jeep'),
                "routing_weight": round(data.get('routing_weight', 0), 2),
            })
    return {"route_name": route_name, "edges": edges, "count": len(edges)}


@admin_router.post("/routes/flip")
async def flip_edge_direction(request: Request):
    """Flip a specific edge's direction (for GIS correction)."""
    body = await request.json()
    from_node = body.get('from_node')
    to_node = body.get('to_node')

    if not from_node or not to_node:
        return JSONResponse(status_code=400, content={"error": "from_node and to_node required"})

    G = request.app.state.G

    if not G.has_edge(from_node, to_node):
        return JSONResponse(status_code=404, content={"error": "Edge not found"})

    edge_data = dict(G.edges[from_node, to_node])
    G.remove_edge(from_node, to_node)
    G.add_edge(to_node, from_node, **edge_data)

    return {
        "status": "flipped",
        "new_from": to_node,
        "new_to": from_node,
        "route": edge_data.get('route', 'Unknown'),
    }


@admin_router.post("/routes/rename")
async def rename_route(request: Request):
    """Rename all edges belonging to a route."""
    body = await request.json()
    old_name = body.get('old_name')
    new_name = body.get('new_name')

    if not old_name or not new_name:
        return JSONResponse(status_code=400, content={"error": "old_name and new_name required"})

    G = request.app.state.G
    renamed = 0

    for u, v, data in G.edges(data=True):
        if data.get('route', '') == old_name:
            G.edges[u, v]['route'] = new_name
            renamed += 1

    return {"status": "renamed", "old_name": old_name, "new_name": new_name, "edges_renamed": renamed}


@admin_router.get("/graph/stats")
async def graph_statistics(request: Request):
    """Return graph statistics for the admin dashboard."""
    G = request.app.state.G

    vehicle_counts = {}
    for u, v, data in G.edges(data=True):
        vtype = data.get('type', 'unknown')
        vehicle_counts[vtype] = vehicle_counts.get(vtype, 0) + 1

    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "vehicle_types": vehicle_counts,
        "is_directed": G.is_directed(),
    }
