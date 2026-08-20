#!/usr/bin/env python3
"""
Populate ph_route_reference table from the routes data.
Run this script to insert all routes into Supabase.
"""

import json
import sys
from datetime import datetime
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Initialize Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Routes data from your message
routes_data = {
    "train": [
        {"route_name": "Taft Avenue - North Avenue", "origin": "Taft Avenue", "destination": "North Avenue", "mode": "train"},
        {"route_name": "Baclaran - Roosevelt", "origin": "Baclaran", "destination": "Roosevelt", "mode": "train"},
        {"route_name": "Recto - Santolan", "origin": "Recto", "destination": "Santolan", "mode": "train"},
        {"route_name": "Metro Commuter", "origin": None, "destination": None, "mode": "train"},
    ],
    "bus": [
        {"route_name": "Baclaran - Montalban via EDSA", "origin": "Baclaran", "destination": "Montalban", "mode": "bus"},
        {"route_name": "Ayala Quiapo via Kamagong Taft", "origin": "Ayala", "destination": "Quiapo", "mode": "bus"},
        {"route_name": "Baclaran SM Fairview via Lagro", "origin": "Baclaran", "destination": "SM Fairview", "mode": "bus"},
        # ... add all bus routes here
    ],
    "jeepney": [
        {"route_name": "CUBAO-STOPnSHOP", "origin": "Cubao", "destination": "Stop n Shop", "mode": "jeepney"},
        {"route_name": "Camarin-Trinoma", "origin": "Camarin", "destination": "Trinoma", "mode": "jeepney"},
        # ... add all jeepney routes here
    ],
}

def parse_route_name(route_name):
    """Try to extract origin and destination from route name."""
    parts = route_name.split(" - ")
    if len(parts) >= 2:
        return parts[0].strip(), parts[-1].strip()
    return None, None

def insert_route(route_name, mode, origin=None, destination=None):
    """Insert a single route into ph_route_reference."""
    if not origin or not destination:
        origin, destination = parse_route_name(route_name)
    
    route = {
        "route_name": route_name,
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "source_file": "full_jeepney_routes.csv",
        "created_at": datetime.utcnow().isoformat(),
    }
    
    # Check if already exists
    existing = supabase.table("ph_route_reference").select("id").eq("route_name", route_name).execute()
    if existing.data:
        print(f"  ⏭️  Already exists: {route_name}")
        return False
    
    # Insert
    res = supabase.table("ph_route_reference").insert(route).execute()
    if res.data:
        print(f"  ✅ Inserted: {route_name}")
        return True
    else:
        print(f"  ❌ Failed: {route_name}")
        return False

def main():
    print("🚀 Populating ph_route_reference...\n")
    
    total_inserted = 0
    total_skipped = 0
    
    # Insert trains
    print("🚆 Trains:")
    for route in routes_data["train"]:
        if insert_route(route["route_name"], route["mode"], route.get("origin"), route.get("destination")):
            total_inserted += 1
        else:
            total_skipped += 1
    
    # Insert buses
    print("\n🚌 Buses:")
    for route in routes_data["bus"]:
        if insert_route(route["route_name"], route["mode"], route.get("origin"), route.get("destination")):
            total_inserted += 1
        else:
            total_skipped += 1
    
    # Insert jeepneys
    print("\n🚐 Jeepneys:")
    for route in routes_data["jeepney"]:
        if insert_route(route["route_name"], route["mode"], route.get("origin"), route.get("destination")):
            total_inserted += 1
        else:
            total_skipped += 1
    
    print(f"\n\n✅ Done! Inserted: {total_inserted}, Skipped: {total_skipped}")

if __name__ == "__main__":
    main()
