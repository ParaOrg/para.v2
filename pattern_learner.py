"""
pattern_learner.py — Route pattern learning, discovery, and congestion detection.
Runs nightly to learn from user tracks and suggest smarter routes.
"""

import asyncio
from datetime import datetime, timedelta
from collections import defaultdict
from database import supabase, fetch_all

async def learn_patterns():
    """Full pattern learning pipeline."""
    print(f"[{datetime.now().isoformat()}] Pattern learning...")
    
    tracks = await fetch_all("ph_user_tracks")
    routes = await fetch_all("ph_routes", eq={"is_approved": True})
    
    # 1. Learn OD patterns (counting)
    await learn_od_patterns(tracks)
    
    # 2. Discover new routes (OD pairs with no official route)
    await discover_new_routes(tracks, routes)
    
    # 3. Detect congestion (time spikes)
    await detect_congestion(tracks, routes)
    
    # 4. Find alternatives (multiple paths for same OD)
    await find_alternatives(tracks)
    
    print(f"[{datetime.now().isoformat()}] Complete.")


async def learn_od_patterns(tracks):
    """Count OD pairs by hour and day."""
    patterns = defaultdict(lambda: {"count": 0, "durations": [], "fares": [], "gps_samples": []})
    
    for track in tracks:
        raw = track.get("raw_payload") or {}
        gps = raw.get("gps_points") or raw.get("gpsPoints") or []
        if len(gps) < 2: continue
        
        o = gps[0]
        d = gps[-1]
        if not o.get("lat") or not d.get("lat"): continue
        
        o_lat, o_lng = round(o["lat"], 3), round(o["lng"], 3)
        d_lat, d_lng = round(d["lat"], 3), round(d["lng"], 3)
        
        created = track.get("created_at", "")
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            hour, dow = dt.hour, dt.weekday()
        except:
            continue
        
        key = (o_lat, o_lng, d_lat, d_lng, hour, dow)
        patterns[key]["count"] += 1
        patterns[key]["durations"].append(track.get("total_time_sec", 0) or 0)
        patterns[key]["fares"].append(raw.get("total_fare", 0) or 0)
        patterns[key]["gps_samples"].extend(gps[:20])
    
    print(f"  OD patterns: {len(patterns)}")
    
    for key, data in patterns.items():
        o_lat, o_lng, d_lat, d_lng, hour, dow = key
        avg_dur = sum(data["durations"]) / len(data["durations"]) if data["durations"] else 0
        avg_fare = sum(data["fares"]) / len(data["fares"]) if data["fares"] else 0
        
        existing = supabase.table("route_patterns").select("id").eq(
            "origin_lat", o_lat).eq("origin_lng", o_lng).eq(
            "dest_lat", d_lat).eq("dest_lng", d_lng).eq(
            "hour_of_day", hour).eq("day_of_week", dow).execute()
        
        data_payload = {
            "frequency": data["count"],
            "avg_duration_sec": int(avg_dur),
            "avg_fare": round(avg_fare, 2),
            "last_seen": "now()",
        }
        
        if existing.data:
            supabase.table("route_patterns").update(data_payload).eq("id", existing.data[0]["id"]).execute()
        else:
            data_payload.update({
                "origin_lat": o_lat, "origin_lng": o_lng,
                "dest_lat": d_lat, "dest_lng": d_lng,
                "hour_of_day": hour, "day_of_week": dow,
            })
            supabase.table("route_patterns").insert(data_payload).execute()


async def discover_new_routes(tracks, routes):
    """Find OD pairs people travel but have no official route."""
    official_od = set()
    for r in routes:
        if r.get("origin_lat") and r.get("dest_lat"):
            official_od.add((
                round(r["origin_lat"], 2), round(r["origin_lng"], 2),
                round(r["dest_lat"], 2), round(r["dest_lng"], 2),
            ))
    
    tracked_od = defaultdict(int)
    for track in tracks:
        raw = track.get("raw_payload") or {}
        gps = raw.get("gps_points") or raw.get("gpsPoints") or []
        if len(gps) < 2: continue
        o, d = gps[0], gps[-1]
        if not o.get("lat") or not d.get("lat"): continue
        key = (round(o["lat"], 2), round(o["lng"], 2), round(d["lat"], 2), round(d["lng"], 2))
        tracked_od[key] += 1
    
    undiscovered = []
    for od, count in tracked_od.items():
        if od not in official_od and count >= 3:
            undiscovered.append({"od": od, "count": count})
    
    print(f"  New routes discovered: {len(undiscovered)}")
    
    for item in undiscovered:
        o_lat, o_lng, d_lat, d_lng = item["od"]
        supabase.table("discovered_routes").upsert({
            "origin_lat": o_lat, "origin_lng": o_lng,
            "dest_lat": d_lat, "dest_lng": d_lng,
            "frequency": item["count"],
            "last_seen": "now()",
        }, on_conflict="origin_lat,origin_lng,dest_lat,dest_lng").execute()


async def detect_congestion(tracks, routes):
    """Compare this week vs last week to find congestion."""
    now = datetime.now()
    
    for route in routes:
        route_id = route.get("route_uuid")
        route_tracks = [t for t in tracks if (t.get("raw_payload") or {}).get("route_uuid") == str(route_id)]
        
        if len(route_tracks) < 5:
            continue
        
        this_week = [t for t in route_tracks if datetime.fromisoformat(t.get("created_at", "").replace("Z", "+00:00")) > now - timedelta(days=3)]
        last_week = [t for t in route_tracks if datetime.fromisoformat(t.get("created_at", "").replace("Z", "+00:00")) > now - timedelta(days=10) and datetime.fromisoformat(t.get("created_at", "").replace("Z", "+00:00")) <= now - timedelta(days=3)]
        
        if not this_week or not last_week:
            continue
        
        this_avg = sum(t.get("total_time_sec", 0) or 0 for t in this_week) / len(this_week)
        last_avg = sum(t.get("total_time_sec", 0) or 0 for t in last_week) / len(last_week)
        
        if this_avg > last_avg * 1.3:
            print(f"  CONGESTED: {route.get('name')} ({last_avg:.0f}s → {this_avg:.0f}s)")
            supabase.table("ph_routes").update({
                "congestion_status": "high",
                "avg_duration_sec": int(this_avg),
            }).eq("route_uuid", route_id).execute()


async def find_alternatives(tracks):
    """Find multiple distinct paths for same OD."""
    od_groups = defaultdict(list)
    
    for track in tracks:
        raw = track.get("raw_payload") or {}
        gps = raw.get("gps_points") or raw.get("gpsPoints") or []
        if len(gps) < 5: continue
        o, d = gps[0], gps[-1]
        key = (round(o.get("lat", 0), 2), round(o.get("lng", 0), 2), round(d.get("lat", 0), 2), round(d.get("lng", 0), 2))
        od_groups[key].append(gps)
    
    alternatives_found = 0
    for od, trails in od_groups.items():
        if len(trails) < 3:
            continue
        
        # Simple clustering: compare midpoints to find distinct paths
        midpoints = defaultdict(list)
        for trail in trails:
            mid = trail[len(trail) // 2]
            mid_key = (round(mid["lat"], 2), round(mid["lng"], 2))
            midpoints[mid_key].append(trail)
        
        if len(midpoints) >= 2:
            alternatives_found += 1
            print(f"  Alternative found: {len(midpoints)} paths for OD {od}")
    
    print(f"  Alternatives found: {alternatives_found}")


if __name__ == "__main__":
    asyncio.run(learn_patterns())
