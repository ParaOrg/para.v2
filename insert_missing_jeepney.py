#!/usr/bin/env python3
"""Insert the 23 missing jeepney routes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

missing_jeepney_routes = [
    "TALA NOVALICHES via QUIRINO AVENUE",
    "TANDANG SORA PALENGKE  - NIA_NPC",
    "TAYTAY-PASIG PALENGKE",
    "Taft Ave - North Ave",  # This is a train route
    "Taguig City Navotas",
    "Talayan Vill A Bonifacio 5th Ave",
    "Talon - Pailiparan (Dasmarinas, Cavite) via Molino Rd.",
    "Tanay - Robinson Galleria via Antipolo San Miguel",
    "Tanay Pasig (Palengke)",
    "Tandang Sora - Visayas Ave. via Q.C. Hall",
    "Tandang Sora Mindanao Ave",
    "Tanza - Zapote (Las Pinas) via Aguinaldo Hi-way",
    "Taytay  - Quiapo via Manila East Road",
    "Taytay-Rosario",
    "Tayuman LRT Pilapil",
    "Treze Martirez Zapote (Las Pinas)",
    "UP - IKOT",
    "UP - MRT",
    "UP - SM NORTH AVE",
    "UP Highway - Sangandaan",
]

def insert_missing():
    print("📥 Inserting missing jeepney routes...\n")
    
    inserted = 0
    skipped = 0
    
    for route_name in missing_jeepney_routes:
        # Determine mode
        mode = "train" if route_name == "Taft Ave - North Ave" else "jeepney"
        
        # Parse origin/destination
        parts = route_name.split(" - ")
        origin = parts[0].strip() if parts else None
        destination = parts[-1].strip() if len(parts) > 1 else None
        
        if destination and " via " in destination:
            destination = destination.split(" via ")[0].strip()
        
        # Check if already exists (might have been inserted with different name)
        check = supabase.table("ph_route_reference").select("id").eq("route_name", route_name).limit(1).execute()
        if check.data:
            print(f"   ⏭️ Already exists: {route_name}")
            skipped += 1
            continue
        
        record = {
            "route_name": route_name,
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "source_file": "full_jeepney_routes.csv",
        }
        
        try:
            res = supabase.table("ph_route_reference").insert(record).execute()
            if res.data:
                inserted += 1
                print(f"   ✅ {route_name} ({mode})")
        except Exception as e:
            print(f"   ⚠️ Error inserting {route_name}: {e}")
    
    print(f"\n📊 Inserted: {inserted}, Skipped: {skipped}")
    
    # Final counts
    print("\n📊 FINAL MODE COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    total = 0
    
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        total += count
        print(f"   {mode}: {count}")
    
    print(f"   Total: {total}")
    print(f"\n   Expected: jeepney should be ~889 (was 836 + {inserted} inserted)")

if __name__ == "__main__":
    insert_missing()
