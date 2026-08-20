#!/usr/bin/env python3
"""Fix route modes in ph_route_reference - update existing routes with correct modes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Route name patterns that indicate specific modes
bus_patterns = [
    "via EDSA",
    "via edsa",
    "Carousel",
    "via Commonwealth",
    "via Coastal",
    "via Aguinaldo",
    "via Quirino",
    "via Sucat",
    "via Alabang-Zapote",
]

train_routes = [
    "Taft Avenue - North Avenue",
    "Baclaran - Roosevelt",
    "Recto - Santolan",
    "Metro Commuter",
]

p2p_patterns = [
    "PITX",
    "Robinsons",
    "SM Megamall",
    "NAIA Terminal",
    "Glorietta",
    "Greenbelt",
]

uv_patterns = [
    "LAGRO - QUIAPO",
    "DEPARO",
    "ANTIPOLO - AYALA",
    "PASIG - QUIAPO",
    "NOVALICHES - TRINOMA",
]

def fix_modes():
    """Update existing routes with correct modes."""
    
    updated = 0
    skipped = 0
    
    # Fix train routes
    print("\n🚆 Fixing train routes...")
    for route_name in train_routes:
        try:
            # Check current mode
            res = supabase.table("ph_route_reference").select("id, mode").eq("route_name", route_name).limit(1).execute()
            if res.data:
                current_mode = res.data[0].get("mode")
                if current_mode != "train":
                    supabase.table("ph_route_reference").update({"mode": "train"}).eq("route_name", route_name).execute()
                    print(f"   ✅ Updated: {route_name} → train")
                    updated += 1
                else:
                    print(f"   ✓ Already correct: {route_name}")
                    skipped += 1
        except Exception as e:
            print(f"   ⚠️ Error: {route_name}: {e}")
    
    # Fix bus routes - find all routes with "via EDSA" etc. that are marked as jeepney
    print("\n🚌 Fixing bus routes...")
    
    # Get all jeepney routes that should be bus
    res = supabase.table("ph_route_reference").select("id, route_name, mode").eq("mode", "jeepney").execute()
    jeepney_routes = res.data or []
    
    for route in jeepney_routes:
        route_name = route.get("route_name", "")
        should_be_bus = any(pattern in route_name for pattern in bus_patterns)
        
        if should_be_bus:
            try:
                supabase.table("ph_route_reference").update({"mode": "bus"}).eq("id", route["id"]).execute()
                updated += 1
                if updated % 20 == 0:
                    print(f"   Updated {updated} routes so far...")
            except Exception as e:
                print(f"   ⚠️ Error updating {route_name}: {e}")
    
    print(f"\n📊 Summary:")
    print(f"   ✅ Updated: {updated}")
    print(f"   ⏭️ Skipped (already correct): {skipped}")

if __name__ == "__main__":
    print("🔧 Fixing route modes in ph_route_reference...")
    fix_modes()
