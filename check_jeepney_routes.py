#!/usr/bin/env python3
"""Check what happened to jeepney routes - were any deleted or incorrectly reclassified?"""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from datetime import datetime, timedelta

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_jeepney_routes():
    print("🔍 Checking Jeepney Routes Status\n")
    
    # Current counts
    total = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    
    jeepney = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "jeepney").limit(0).execute()
    jeepney_count = jeepney.count if hasattr(jeepney, 'count') else 0
    
    bus = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", "bus").limit(0).execute()
    bus_count = bus.count if hasattr(bus, 'count') else 0
    
    print(f"Total: {total_count}")
    print(f"Jeepney: {jeepney_count}")
    print(f"Bus: {bus_count}")
    
    # Check what routes were changed from jeepney to bus
    print("\n🔍 Routes that were changed from jeepney to bus:")
    
    # Get all bus routes that might have been jeepney
    bus_routes = supabase.table("ph_route_reference").select("route_name, source_file").eq("mode", "bus").execute()
    
    if bus_routes.data:
        for route in bus_routes.data:
            route_name = route.get("route_name", "")
            source = route.get("source_file", "unknown")
            # Check if this looks like a jeepney route that got reclassified
            if any(pattern in route_name for pattern in ["via EDSA", "via edsa"]):
                print(f"  ⚠️ {route_name} (source: {source})")
    
    # Check source files to understand where routes came from
    print("\n📁 Source files distribution:")
    sources = supabase.table("ph_route_reference").select("source_file").execute()
    if sources.data:
        source_dist = {}
        for s in sources.data:
            src = s.get("source_file", "unknown")
            source_dist[src] = source_dist.get(src, 0) + 1
        
        for src, count in sorted(source_dist.items(), key=lambda x: -x[1]):
            print(f"  {src}: {count}")
    
    # Check recent updates
    print("\n🕐 Recent mode updates (last hour):")
    try:
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        
        # Since Supabase doesn't easily show update history, check updated_at if it exists
        recent_updates = supabase.table("ph_route_reference").select("route_name, mode, updated_at").order("updated_at", desc=True).limit(20).execute()
        if recent_updates.data:
            for route in recent_updates.data:
                print(f"  • {route.get('route_name')} → {route.get('mode')}")
    except Exception as e:
        print(f"  Could not check recent updates: {e}")
    
    # Check if we can identify routes that should still be jeepney
    print("\n🔧 Identifying routes that should be jeepney but are marked as bus:")
    
    # Jeepney routes typically don't have "via EDSA" or long distance patterns
    jeepney_indicators = [
        "CUBAO", "QUIAPO", "DIVISORIA", "BLUMENTRITT", "LIBERTAD",
        "MONUMENTO", "PIER", "RECT", "STA CRUZ", "BACLARAN",
        "KALENTONG", "GUADALUPE", "PATEROS", "PASIG", "MARIKINA"
    ]
    
    bus_routes = supabase.table("ph_route_reference").select("route_name").eq("mode", "bus").execute()
    if bus_routes.data:
        potentially_jeepney = []
        for route in bus_routes.data:
            route_name = route.get("route_name", "")
            # If route doesn't have "via EDSA" or similar bus patterns but has jeepney indicators
            has_bus_pattern = any(p in route_name for p in ["via EDSA", "via edsa", "via Commonwealth", "Carousel"])
            has_jeepney_indicator = any(ind in route_name.upper() for ind in jeepney_indicators)
            
            if has_jeepney_indicator and not has_bus_pattern:
                potentially_jeepney.append(route_name)
        
        if potentially_jeepney:
            print(f"  Found {len(potentially_jeepney)} routes that might need to be jeepney:")
            for name in potentially_jeepney[:20]:
                print(f"    • {name}")
        else:
            print("  No obvious misclassifications found")

if __name__ == "__main__":
    check_jeepney_routes()
