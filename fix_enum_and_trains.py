#!/usr/bin/env python3
"""Fix ph_routes enum and align train data with existing transit_stops."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_existing_trains():
    print("🔍 Existing train stops in transit_stops...\n")
    
    res = supabase.table("transit_stops").select("route_name, name").eq("vehicle_type", "train").execute()
    if res.data:
        train_lines = {}
        for stop in res.data:
            line = stop.get("route_name", "")
            if line not in train_lines:
                train_lines[line] = []
            train_lines[line].append(stop.get("name", ""))
        
        for line, stops in train_lines.items():
            print(f"   {line}: {len(stops)} stops")
            if stops:
                print(f"      First: {stops[0]}, Last: {stops[-1]}")
    else:
        print("   No train stops found")

def check_graph_engine():
    print("\n🔍 How graph_engine handles vehicle types...")
    
    with open("graph_engine.py", "r") as f:
        content = f.read()
    
    # Find where modes are used
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'vehicle_type' in line or 'mode' in line.lower():
            print(f"   Line {i+1}: {line.strip()[:100]}")

def fix_ph_routes_enum():
    print("\n🔧 Fixing ph_routes to support train mode...")
    
    # Check what modes ph_routes currently supports
    # The enum seems to only have 'jeepney'
    # We need to add 'train' as a valid enum value
    
    print("""
    The ph_routes table has an enum for mode that only includes 'jeepney'.
    You need to run this SQL in Supabase SQL editor:
    
    ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'train';
    ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'bus';
    ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'bgc_bus';
    ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'p2p';
    ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'uv_express';
    
    Or if you can't add to enum:
    
    ALTER TABLE ph_routes 
    ALTER COLUMN mode TYPE TEXT 
    USING mode::TEXT;
    
    Then update the train routes in ph_routes:
    
    INSERT INTO ph_routes (name, mode, is_approved, status, source_file, route_type)
    SELECT 
        route_name,
        'train',
        true,
        'approved',
        'manual_train_routes',
        'rail'
    FROM ph_route_reference
    WHERE mode = 'train';
    """)

def align_train_names_with_stops():
    print("\n🔧 Aligning train route names with transit_stops...")
    
    # The transit_stops uses "LRT-1" format (with dash)
    # The ph_route_reference uses "Baclaran - Roosevelt" format
    # Need to update ph_route_reference to match transit_stops
    
    train_mapping = {
        "Baclaran - Roosevelt": "LRT-1",
        "Recto - Santolan": "LRT-2",
        "Taft Avenue - North Avenue": "MRT-3",
        "Metro Commuter": "PNR",
    }
    
    for old_name, new_name in train_mapping.items():
        res = supabase.table("ph_route_reference").select("id").eq("route_name", old_name).eq("mode", "train").limit(1).execute()
        
        if res.data:
            route_id = res.data[0]["id"]
            supabase.table("ph_route_reference").update({
                "route_name": new_name,
            }).eq("id", route_id).execute()
            print(f"   ✅ {old_name} → {new_name}")

def update_train_stops():
    print("\n🔧 Checking train stops data...")
    
    # The existing stops use "LRT-1" format
    # Let's see what stops already exist
    res = supabase.table("transit_stops").select("route_name, name").eq("vehicle_type", "train").execute()
    
    if res.data:
        existing = {}
        for stop in res.data:
            line = stop.get("route_name", "")
            if line not in existing:
                existing[line] = []
            existing[line].append(stop.get("name", ""))
        
        print(f"   Existing train lines: {list(existing.keys())}")
        
        for line, stops in existing.items():
            print(f"   {line}: {len(stops)} stops")

if __name__ == "__main__":
    check_existing_trains()
    check_graph_engine()
    fix_ph_routes_enum()
    align_train_names_with_stops()
    update_train_stops()
