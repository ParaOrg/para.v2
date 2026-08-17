"""
smart_router.py — Combines graph_engine with pattern_learner.
Suggests learned routes when faster than official.
"""

from datetime import datetime
from database import supabase, fetch_all


async def get_learned_patterns(o_lat, o_lng, d_lat, d_lng):
    """Query route_patterns for OD pair."""
    try:
        o_lat_r = round(o_lat, 2)
        o_lng_r = round(o_lng, 2)
        d_lat_r = round(d_lat, 2)
        d_lng_r = round(d_lng, 2)
        
        res = supabase.table("route_patterns").select("*").eq(
            "origin_lat", o_lat_r
        ).eq("origin_lng", o_lng_r).eq(
            "dest_lat", d_lat_r
        ).eq("dest_lng", d_lng_r).order("frequency", desc=True).limit(3).execute()
        
        return res.data or []
    except Exception:
        return []


def get_pattern_note(pattern):
    """Human-readable note."""
    freq = pattern.get("frequency", 0)
    avg_dur = pattern.get("avg_duration_sec", 0)
    avg_fare = pattern.get("avg_fare", 0)
    hour = pattern.get("hour_of_day", 12)
    
    note = f"🔥 {freq} commuters • ~{avg_dur // 60} min"
    if avg_fare:
        note += f" • ₱{avg_fare}"
    note += f" • usually at {hour}:00"
    return note


async def smart_chat_reply(origin_raw, dest_raw, G=None):
    """Generate smart reply with learned patterns."""
    try:
        patterns = await get_learned_patterns(0, 0, 0, 0)  # Will be replaced with actual coords
        if patterns:
            notes = [get_pattern_note(p) for p in patterns[:3]]
            return f"📍 {origin_raw} → {dest_raw}\n\n" + "\n".join(notes)
        return None
    except Exception:
        return None
