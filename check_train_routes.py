#!/usr/bin/env python3
"""Check how train routes are stored and used in the system."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_trains():
    print("🔍 Checking train routes in both tables\n")
    
    # Check ph_route_reference
    print("📋 ph_route_reference - Train routes:")
    ref_res = supabase.table("ph_route_reference").select("id, route_name, origin, destination, mode").eq("mode", "train").execute()
    if ref_res.data:
        for route in ref_res.data:
            print(f"   • {route['route_name']}")
            print(f"     ID: {route['id']}, Origin: {route.get('origin')}, Dest: {route.get('destination')}")
    
    # Check ph_routes
    print("\n📋 ph_routes - Train routes:")
    routes_res = supabase.table("ph_routes").select("route_uuid, name, mode, route_type, status").eq("mode", "train").execute()
    if routes_res.data:
        for route in routes_res.data:
            print(f"   • {route['name']}")
            print(f"     UUID: {route['route_uuid']}, type: {route.get('route_type')}, status: {route.get('status')}")
    
    # Check transit_stops if it exists
    print("\n📋 transit_stops - Train stops:")
    try:
        stops_res = supabase.table("transit_stops").select("name, vehicle_type, route_name").eq("vehicle_type", "train").limit(10).execute()
        if stops_res.data:
            for stop in stops_res.data:
                print(f"   • {stop.get('route_name')} - {stop.get('name')}")
        else:
            print("   No train stops found")
    except:
        print("   transit_stops table not found or no data")
    
    # Check what the graph engine expects
    print("\n📋 How graph_engine uses train routes:")
    import subprocess
    result = subprocess.run(["grep", "-n", "train\|MRT\|LRT\|PNR", "graph_engine.py"], 
                          capture_output=True, text=True)
    for line in result.stdout.split('\n')[:20]:
        if line.strip():
            print(f"   {line}")

if __name__ == "__main__":
    check_trains()
