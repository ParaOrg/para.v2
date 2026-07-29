"""
Core API — Chat, Routing, Feedback, Telemetry
"""

import sqlite3, json, uuid, networkx as nx
from fastapi import APIRouter, Request
from models import RouteRequest, RouteResponse, RouteStep, ChatMessage, ChatResponse, FeedbackRequest, TelemetryPing, TelemetryBatch, SimulateRequest
from graph_engine import haversine, SPEED_WALK_KMH
from llm_engine import parse_chat_intent_async, ask_info_llm, geocode_location

router = APIRouter()

# ═══════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════
def _connect_virtual(G, vid, lat, lng, is_source):
    grid = G.graph.get('spatial_grid',{})
    gs = G.graph.get('grid_size',0.0005)
    gx, gy = int(lat/gs), int(lng/gs)
    cands = []
    # EXPANDED: search 8 cells in each direction
    for dx in range(-8, 9):
        for dy in range(-8, 9):
            for n in grid.get((gx+dx,gy+dy),[]):
                d = haversine(lat,lng,G.nodes[n]['lat'],G.nodes[n]['lng'])
                if d < 5000:  # up to 5km walk
                    cands.append((n,d,(d/1000)/SPEED_WALK_KMH*60))
    if not cands:
        best, bd = None, float('inf')
        for n,nd in G.nodes(data=True):
            if n.startswith("VIRTUAL"): continue
            d = haversine(lat,lng,nd['lat'],nd['lng'])
            if d<bd: bd=d; best=n
        if best: cands.append((best,bd,(bd/1000)/SPEED_WALK_KMH*60))
    cands.sort(key=lambda x:x[2])
    for n,d,t in cands[:5]:
        if is_source: G.add_edge(vid,n,distance=d,time_min=t,routing_weight=t,route="WALK_TO_TRANSIT",type="walk")
        else: G.add_edge(n,vid,distance=d,time_min=t,routing_weight=t,route="WALK_FROM_TRANSIT",type="walk")
        
def _calc_route(G, path):
    segs, cur = [], None
    skip_routes = {'WALK_TRANSFER','WALK_TO_TRANSIT','WALK_FROM_TRANSIT'}
    for i in range(len(path)-1):
        u,v = path[i],path[i+1]
        if not G.has_edge(u,v): continue
        e = G.edges[u,v]
        d = e.get('distance',0)
        t = e.get('time_min',0)
        vt = e.get('type','walk')
        rn = e.get('route','?')
        # Skip walk transfer edges
        if rn in skip_routes or vt == 'walk':
            vt = 'walk'
            rn = 'Walk'
        if not cur or cur['type']!=vt:
            if cur: segs.append(cur)
            cur = {'type':vt,'route':rn,'dist':0,'time':0,'geom':[[G.nodes[u].get('lng',121),G.nodes[u].get('lat',14.5)]]}
        cur['dist']+=d; cur['time']+=t
        cur['geom'].append([G.nodes[v].get('lng',121),G.nodes[v].get('lat',14.5)])
    if cur: segs.append(cur)
    
    steps, td, tf, tt = [], 0, 0, 0
    for s in segs:
        td += s['dist']; tt += s['time']
        # Fare: only for actual transit, not walk
        if s['type'] == 'walk':
            fare = 0
        elif s['type'] in ('jeep','jeepney'):
            fare = 13 + max(0,(s['dist']/1000-4))*2.5
        elif s['type'] in ('bus',):
            fare = 15 + max(0,(s['dist']/1000-5))*2.5
        elif s['type'] in ('lrt','mrt','train'):
            fare = 15  # base LRT/MRT
        else:
            fare = 13  # default
        tf += fare
        act = "walk" if s['type']=='walk' else ("board" if not steps or steps[-1].action=="walk" else "transfer")
        steps.append(RouteStep(action=act,vehicle_type=s['type'],route_name=s['route'],from_node="?",to_node="?",distance_m=s['dist'],duration_min=s['time'],fare=fare,geometry=s['geom']))
    
    return RouteResponse(success=True,total_distance_m=td,total_duration_min=tt,total_fare=tf,steps=steps,path_nodes=path,message=f"{tt:.0f} mins, ₱{tf:.0f}.")

def find_routes(G_global, req, db_path="para_ml_data.db"):
    from telemetry_engine import apply_traffic_to_graph
    G = G_global.copy()
    try: G = apply_traffic_to_graph(G, db_path)
    except: pass
    uid = str(uuid.uuid4())[:8]
    src, tgt = f"V_SRC_{uid}", f"V_TGT_{uid}"
    G.add_node(src,lat=req.origin_lat,lng=req.origin_lng)
    G.add_node(tgt,lat=req.dest_lat,lng=req.dest_lng)
    try:
        _connect_virtual(G,src,req.origin_lat,req.origin_lng,True)
        _connect_virtual(G,tgt,req.dest_lat,req.dest_lng,False)
        if G.degree(src)==0 or G.degree(tgt)==0: return None,[]
        try: p1 = nx.shortest_path(G,src,tgt,weight='routing_weight')
        except: return None,[]
        r1 = _calc_route(G,p1)
        if not r1 or not r1.steps: return None,[]
        penalized = []
        for i in range(len(p1)-1):
            u,v = p1[i],p1[i+1]
            if G.has_edge(u,v):
                ow = G.edges[u,v].get('routing_weight',1)
                penalized.append((u,v,ow))
                G.edges[u,v]['routing_weight']=ow*3
        r2 = None
        try:
            p2 = nx.shortest_path(G,src,tgt,weight='routing_weight')
            if p2!=p1:
                r2 = _calc_route(G,p2)
                if r2 and r2.steps:
                    if abs(r2.total_distance_m-r1.total_distance_m)<10 and len(r2.steps)==len(r1.steps): r2=None
        except: pass
        finally:
            for u,v,ow in penalized:
                if G.has_edge(u,v): G.edges[u,v]['routing_weight']=ow
        alts = [r2] if r2 else []
        return r1, alts
    finally:
        if G.has_node(src): G.remove_node(src)
        if G.has_node(tgt): G.remove_node(tgt)

# ═══════════════════════════════════════════════════════
# CHAT
# ═══════════════════════════════════════════════════════
@router.post("/chat", response_model=ChatResponse)
async def chat(msg: ChatMessage, req: Request):
    G = req.app.state.G
    db_path = req.app.state.db_path
    intent = await parse_chat_intent_async(msg.message)
    if intent.get('intent')=='INFO':
        ans = await ask_info_llm(intent.get('question',msg.message))
        return ChatResponse(reply_text=ans)
    o_name, d_name = intent.get('origin',''), intent.get('destination','')
    if not o_name or not d_name:
        return ChatResponse(reply_text="Saan ka pupunta?")
    o_ll = await geocode_location(o_name)
    d_ll = await geocode_location(d_name)
    if not o_ll or not d_ll:
        return ChatResponse(reply_text="Hindi ko mahanap ang lokasyon.",origin=o_name,destination=d_name)
    # Crowdsourced check
    db = sqlite3.connect(db_path)
    cur = db.cursor()
    cur.execute("SELECT path_nodes,total_fare,total_time,rating_sum,trip_count FROM approved_routes WHERE origin=? AND destination=? ORDER BY (rating_sum*1.0/trip_count) DESC LIMIT 1",(o_name.lower(),d_name.lower()))
    row = cur.fetchone()
    db.close()
    if row:
        nodes_json, fare, time, rsum, trips = row
        if rsum/trips >= 5:
            path = json.loads(nodes_json)
            r = _calc_route(G, path)
            r.message = f"🌟 Commuter Favorite ({trips} trips): {time:.0f} mins, ₱{fare:.0f}."
            return ChatResponse(reply_text=f"📍 {o_name} ➡️ {d_name}\n{r.message}",route_data=r,origin=o_name,destination=d_name)
    # Route calculation
    rr = RouteRequest(origin_lat=o_ll[0],origin_lng=o_ll[1],dest_lat=d_ll[0],dest_lng=d_ll[1])
    primary, alts = find_routes(G, rr, db_path)
    if not primary:
        return ChatResponse(reply_text="Walang nakitang ruta.",origin=o_name,destination=d_name)
    reply = f"📍 {o_name} ➡️ {d_name}\n✅ {primary.message}"
    if alts: reply += f"\n🔄 {len(alts)} alternatibo."
    return ChatResponse(reply_text=reply,route_data=primary,alternatives=alts,origin=o_name,destination=d_name)

# ═══════════════════════════════════════════════════════
# FEEDBACK
# ═══════════════════════════════════════════════════════
@router.post("/feedback")
async def feedback(fb: FeedbackRequest):
    db = sqlite3.connect("para_ml_data.db"); cur = db.cursor()
    cur.execute("INSERT INTO route_feedback(user_id,route_id,rating,comment,timestamp) VALUES(?,?,?,?,datetime('now'))",(fb.user_id,fb.route_id,fb.rating,fb.comment))
    if fb.rating>=6 and fb.route_nodes:
        try:
            cur.execute("INSERT INTO approved_routes(origin,destination,path_nodes,total_fare,total_time,rating_sum,trip_count) VALUES(?,?,?,?,?,?,1) ON CONFLICT(origin,destination,path_nodes) DO UPDATE SET rating_sum=rating_sum+excluded.rating_sum,trip_count=trip_count+1",
                (fb.origin_name.lower(),fb.destination_name.lower(),json.dumps(fb.route_nodes),fb.total_fare,fb.total_time,fb.rating))
        except: pass
    db.commit(); db.close()
    return {"status":"success"}

# ═══════════════════════════════════════════════════════
# TELEMETRY
# ═══════════════════════════════════════════════════════
@router.post("/telemetry/ping")
async def ping(p: TelemetryPing, req: Request):
    from telemetry_engine import ingest_ping
    pid = ingest_ping(req.app.state.db_path,p.device_id,p.lat,p.lng,p.speed_kmh,p.heading,p.trip_id)
    return {"status":"ok","ping_id":pid}

@router.post("/telemetry/batch")
async def batch(b: TelemetryBatch, req: Request):
    from telemetry_engine import ingest_ping
    ok = sum(1 for p in b.pings if ingest_ping(req.app.state.db_path,p.device_id,p.lat,p.lng,p.speed_kmh,p.heading,p.trip_id)>0)
    return {"status":"ok","accepted":ok}

@router.post("/telemetry/simulate")
async def simulate(s: SimulateRequest, req: Request):
    from telemetry_engine import simulate_telemetry_ping
    results = [simulate_telemetry_ping(req.app.state.db_path,req.app.state.G,s.route_name) for _ in range(s.count)]
    return {"status":"ok","results":results}

@router.post("/traffic/analyze")
async def analyze(req: Request):
    from telemetry_engine import update_congestion
    return {"status":"ok","summary":update_congestion(req.app.state.db_path,req.app.state.G)}

@router.get("/traffic/geojson")
async def traffic_geo(req: Request):
    from telemetry_engine import get_traffic_geojson
    return get_traffic_geojson(req.app.state.db_path)