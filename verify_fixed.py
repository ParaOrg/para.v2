#!/usr/bin/env python3
"""Verify route modes after fixing."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Check by mode
modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
print("📈 Routes by mode after fix:")
for mode in modes:
    res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
    count = res.count if hasattr(res, 'count') else len(res.data or [])
    print(f"   {mode}: {count}")

# Verify specific routes
test_routes = [
    ("Baclaran - Montalban via EDSA", "bus"),
    ("Taft Avenue - North Avenue", "train"),
    ("Baclaran - Roosevelt", "train"),
    ("Recto - Santolan", "train"),
    ("EDSA Carousel", "bus"),
    ("UP - IKOT", "jeepney"),
    ("CUBAO-STOPnSHOP", "jeepney"),
]

print("\n🔍 Verifying specific routes:")
for route_name, expected_mode in test_routes:
    res = supabase.table("ph_route_reference").select("mode").eq("route_name", route_name).limit(1).execute()
    if res.data:
        actual_mode = res.data[0]["mode"]
        status = "✅" if actual_mode == expected_mode else "❌"
        print(f"   {status} {route_name}: {actual_mode} (expected: {expected_mode})")
    else:
        print(f"   ⚠️ {route_name}: NOT FOUND")
