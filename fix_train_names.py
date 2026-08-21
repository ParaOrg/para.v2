#!/usr/bin/env python3
"""Fix train route names to use proper line identifiers."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Proper train route mapping
train_routes = [
    {
        "old_name": "Taft Avenue - North Avenue",
        "new_name": "MRT3",
        "route_long_name": "MRT3 Taft Avenue - North Avenue",
        "origin": "Taft Avenue",
        "destination": "North Avenue",
        "line": "MRT3",
    },
    {
        "old_name": "Baclaran - Roosevelt",
        "new_name": "LRT1",
        "route_long_name": "LRT1 Baclaran - Roosevelt",
        "origin": "Baclaran",
        "destination": "Roosevelt",
        "line": "LRT1",
    },
    {
        "old_name": "Recto - Santolan",
        "new_name": "LRT2",
        "route_long_name": "LRT2 Recto - Santolan",
        "origin": "Recto",
        "destination": "Santolan",
        "line": "LRT2",
    },
    {
        "old_name": "Metro Commuter",
        "new_name": "PNR",
        "route_long_name": "PNR Metro Commuter",
        "origin": None,
        "destination": None,
        "line": "PNR",
    },
]

def fix_train_names():
    print("🔧 Fixing train route names...\n")
    
    for train in train_routes:
        old_name = train["old_name"]
        
        # Update ph_route_reference
        ref_res = supabase.table("ph_route_reference").select("id").eq("route_name", old_name).eq("mode", "train").limit(1).execute()
        
        if ref_res.data:
            route_id = ref_res.data[0]["id"]
            
            # Update with proper name
            supabase.table("ph_route_reference").update({
                "route_name": train["route_long_name"],
                "origin": train["origin"],
                "destination": train["destination"],
            }).eq("id", route_id).execute()
            
            print(f"   ✅ Updated reference: {old_name} → {train['route_long_name']}")
        
        # Update ph_routes if exists
        routes_res = supabase.table("ph_routes").select("route_uuid").eq("name", old_name).eq("mode", "train").limit(1).execute()
        
        if routes_res.data:
            route_uuid = routes_res.data[0]["route_uuid"]
            
            supabase.table("ph_routes").update({
                "name": train["route_long_name"],
            }).eq("route_uuid", route_uuid).execute()
            
            print(f"   ✅ Updated ph_routes: {old_name} → {train['route_long_name']}")
    
    # Verify
    print("\n📊 Final train routes in ph_route_reference:")
    res = supabase.table("ph_route_reference").select("route_name, origin, destination").eq("mode", "train").execute()
    if res.data:
        for route in res.data:
            print(f"   • {route['route_name']}")
            print(f"     {route.get('origin')} → {route.get('destination')}")

if __name__ == "__main__":
    fix_train_names()
