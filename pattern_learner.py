"""
pattern_learner.py — Nightly job to learn route patterns from user tracks.
Runs every 24 hours via Render cron or manually.
"""

import asyncio
from datetime import datetime, timedelta
from collections import defaultdict
from database import supabase, fetch_all

async def learn_route_patterns():
    """Analyze last 24h of tracks and update route_patterns."""
    print(f"[{datetime.now().isoformat()}] Starting pattern learning...")
    
    # Fetch last 24h of tracks
    since = (datetime.now() - timedelta(hours=24)).isoformat()
    tracks = await fetch_all("ph_user_tracks", order="-created_at")
    
    # Filter to last 24h (fetch_all returns all, filter locally)
    recent = []
    for t in tracks:
        created = t.get("created_at", "")
        if created >= since:
            recent.append(t)
    
    print(f"Found {len(recent)} tracks from last 24h")
    
    if not recent:
        print("No tracks to analyze.")
        return
    
    # Group by OD pair + hour
    patterns = defaultdict(lambda: {
        "count": 0,
        "total_duration": 0,
        "total_fare": 0,
        "gps_samples": [],
    })
    
    for track in recent:
        raw = track.get("raw_payload") or {}
        gps_points = raw.get("gps_points") or raw.get("gpsPoints") or []
        
        if len(gps_points) < 2:
            continue
        
        origin = gps_points[0]
        dest = gps_points[-1]
        
        if not origin.get("lat") or not dest.get("lat"):
            continue
        
        # Round to ~100m precision
        o_lat = round(origin["lat"], 3)
        o_lng = round(origin["lng"], 3)
        d_lat = round(dest["lat"], 3)
        d_lng = round(dest["lng"], 3)
        
        created_dt = datetime.fromisoformat(track.get("created_at", "").replace("Z", "+00:00"))
        hour = created_dt.hour
        dow = created_dt.weekday()
        
        key = (o_lat, o_lng, d_lat, d_lng, hour, dow)
        
        patterns[key]["count"] += 1
        patterns[key]["total_duration"] += track.get("total_time_sec", 0) or 0
        
        # Extract fare from raw_payload
        fare = raw.get("total_fare", 0) or 0
        patterns[key]["total_fare"] += fare
        
        # Sample GPS for path averaging
        if len(patterns[key]["gps_samples"]) < 50:
            patterns[key]["gps_samples"].extend(gps_points[:20])
    
    print(f"Found {len(patterns)} unique OD patterns")
    
    # Upsert to route_patterns
    for key, data in patterns.items():
        o_lat, o_lng, d_lat, d_lng, hour, dow = key
        
        avg_duration = data["total_duration"] / data["count"] if data["count"] > 0 else 0
        avg_fare = data["total_fare"] / data["count"] if data["count"] > 0 else 0
        
        pattern = {
            "origin_lat": o_lat,
            "origin_lng": o_lng,
            "dest_lat": d_lat,
            "dest_lng": d_lng,
            "hour_of_day": hour,
            "day_of_week": dow,
            "frequency": data["count"],
            "avg_duration_sec": int(avg_duration),
            "avg_fare": round(avg_fare, 2),
            "last_seen": "now()",
        }
        
        try:
            # Check if exists
            existing = supabase.table("route_patterns").select("id").eq(
                "origin_lat", o_lat
            ).eq("origin_lng", o_lng).eq(
                "dest_lat", d_lat
            ).eq("dest_lng", d_lng).eq(
                "hour_of_day", hour
            ).eq("day_of_week", dow).execute()
            
            if existing.data:
                # Update
                supabase.table("route_patterns").update({
                    "frequency": data["count"],
                    "avg_duration_sec": int(avg_duration),
                    "avg_fare": round(avg_fare, 2),
                    "last_seen": "now()",
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                # Insert
                supabase.table("route_patterns").insert(pattern).execute()
        except Exception as e:
            print(f"Failed to upsert pattern: {e}")
    
    print(f"[{datetime.now().isoformat()}] Pattern learning complete.")


async def get_route_suggestion(origin_lat, origin_lng, dest_lat, dest_lng, hour=None):
    """Get most common route for OD pair at given hour."""
    if hour is None:
        hour = datetime.now().hour
    
    o_lat = round(origin_lat, 3)
    o_lng = round(origin_lng, 3)
    d_lat = round(dest_lat, 3)
    d_lng = round(dest_lng, 3)
    
    res = supabase.table("route_patterns").select("*").eq(
        "origin_lat", o_lat
    ).eq("origin_lng", o_lng).eq(
        "dest_lat", d_lat
    ).eq("dest_lng", d_lng).order("frequency", desc=True).limit(5).execute()
    
    return res.data or []


# Run via: python pattern_learner.py
if __name__ == "__main__":
    asyncio.run(learn_route_patterns())
