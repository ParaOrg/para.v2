#!/usr/bin/env python3
"""Check all route modes are properly classified."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_all_modes():
    print("🔍 COMPLETE MODE VERIFICATION\n")
    
    # Get all routes with their modes
    res = supabase.table("ph_route_reference").select("route_name, mode, source_file").execute()
    
    if not res.data:
        print("No routes found!")
        return
    
    routes = res.data
    
    # Count by mode
    mode_counts = {}
    for route in routes:
        mode = route.get("mode", "unknown")
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
    
    print("📊 Mode distribution:")
    for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
        print(f"   {mode}: {count}")
    
    # Check trains specifically
    print("\n🚆 TRAIN ROUTES:")
    train_routes = [r for r in routes if r.get("mode") == "train"]
    for route in train_routes:
        print(f"   • {route['route_name']}")
    
    # Check if any routes are missing
    expected_trains = [
        "Taft Avenue - North Avenue",
        "Baclaran - Roosevelt",
        "Recto - Santolan",
        "Metro Commuter",
    ]
    
    print("\n🔍 Train route check:")
    for expected in expected_trains:
        found = any(r["route_name"] == expected and r["mode"] == "train" for r in routes)
        status = "✅" if found else "❌"
        print(f"   {status} {expected}")
    
    # Check BGC buses
    print("\n🚌 BGC BUS ROUTES:")
    bgc_routes = [r for r in routes if r.get("mode") == "bgc_bus"]
    for route in bgc_routes:
        print(f"   • {route['route_name']}")
    
    # Check P2P
    print("\n🚐 P2P ROUTES:")
    p2p_routes = [r for r in routes if r.get("mode") == "p2p"]
    for route in p2p_routes:
        print(f"   • {route['route_name']}")
    
    # Check UV Express
    print("\n🚙 UV EXPRESS ROUTES:")
    uv_routes = [r for r in routes if r.get("mode") == "uv_express"]
    for route in uv_routes:
        print(f"   • {route['route_name']}")
    
    # Check for common misclassifications
    print("\n⚠️ POTENTIAL MISCLASSIFICATIONS:")
    
    # Routes that might be UV but are marked as jeepney
    uv_indicators = ["LAGRO - QUIAPO", "DEPARO", "ANTIPOLO - AYALA", "PASIG - QUIAPO"]
    for route in routes:
        if route.get("mode") == "jeepney" and any(ind in route["route_name"] for ind in uv_indicators):
            print(f"   ⚠️ Might be UV: {route['route_name']} (currently jeepney)")
    
    # Routes that might be bus but are marked as jeepney
    bus_indicators = ["via EDSA", "Carousel", "NAIA", "Lagro"]
    for route in routes:
        if route.get("mode") == "jeepney" and any(ind in route["route_name"] for ind in bus_indicators):
            print(f"   ⚠️ Might be bus: {route['route_name']} (currently jeepney)")
    
    # Routes that might be train but are marked as something else
    train_indicators = ["MRT", "LRT", "PNR"]
    for route in routes:
        if route.get("mode") != "train" and any(ind in route["route_name"] for ind in train_indicators):
            print(f"   ⚠️ Might be train: {route['route_name']} (currently {route['mode']})")

if __name__ == "__main__":
    check_all_modes()
