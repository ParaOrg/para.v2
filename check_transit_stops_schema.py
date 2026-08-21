#!/usr/bin/env python3
"""Check transit_stops table schema."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_schema():
    print("🔍 Checking transit_stops table...\n")
    
    res = supabase.table("transit_stops").select("*").limit(1).execute()
    
    if res.data:
        print("Columns in transit_stops:")
        for key in res.data[0].keys():
            print(f"   • {key}")
        
        print(f"\nSample data:")
        for key, value in res.data[0].items():
            print(f"   {key}: {value}")
    else:
        print("No data in transit_stops")
        print(f"Response: {res}")
    
    # Also check ph_routes mode enum
    print("\n🔍 Checking ph_routes mode enum values...")
    try:
        modes_res = supabase.table("ph_routes").select("mode").limit(100).execute()
        if modes_res.data:
            modes = set(r.get("mode") for r in modes_res.data)
            print(f"Valid modes in ph_routes:")
            for mode in sorted(modes):
                print(f"   • {mode}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
