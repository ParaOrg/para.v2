#!/usr/bin/env python3
"""Restore any routes that were incorrectly changed from jeepney to bus."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def restore_jeepney_routes():
    print("🔧 Restoring incorrectly classified jeepney routes...\n")
    
    # These are routes that should definitely be jeepney
    jeepney_only_patterns = [
        "CUBAO", "QUIAPO", "DIVISORIA", "BLUMENTRITT", "LIBERTAD",
        "MONUMENTO", "PIER", "RECT", "STA CRUZ", "BACLARAN",
        "KALENTONG", "GUADALUPE", "PATEROS", "PASIG", "MARIKINA",
        "Stop", "Shop", "Palengke", "Market", "Gate"
    ]
    
    # Get all bus routes
    bus_routes = supabase.table("ph_route_reference").select("id, route_name, mode").eq("mode", "bus").execute()
    
    if not bus_routes.data:
        print("No bus routes found")
        return
    
    restored = 0
    for route in bus_routes.data:
        route_name = route.get("route_name", "")
        
        # Check if this is actually a jeepney route
        has_bus_pattern = any(p in route_name.lower() for p in [
            "via edsa", "via commonwealth", "carousel", "nlex", "slex",
            "coastal", "expressway", "highway", "lagro", "fairview"
        ])
        
        has_jeepney_pattern = any(p in route_name.upper() for p in jeepney_only_patterns)
        
        # If it has jeepney indicators but no bus patterns, it's likely jeepney
        if has_jeepney_pattern and not has_bus_pattern:
            try:
                supabase.table("ph_route_reference").update({"mode": "jeepney"}).eq("id", route["id"]).execute()
                restored += 1
                print(f"  ✅ Restored: {route_name}")
            except Exception as e:
                print(f"  ⚠️ Error restoring {route_name}: {e}")
    
    print(f"\n📊 Restored {restored} routes back to jeepney")

if __name__ == "__main__":
    restore_jeepney_routes()
