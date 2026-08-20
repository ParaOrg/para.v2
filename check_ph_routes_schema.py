#!/usr/bin/env python3
"""Check ph_routes table schema."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_schema():
    print("🔍 Checking ph_routes table...\n")
    
    # Try to get one row to see the columns
    res = supabase.table("ph_routes").select("*").limit(1).execute()
    
    if res.data:
        print("Columns in ph_routes:")
        for key in res.data[0].keys():
            print(f"   • {key}")
        
        print(f"\nSample data:")
        for key, value in res.data[0].items():
            print(f"   {key}: {value}")
    else:
        print("No data in ph_routes or error")
        print(f"Response: {res}")

if __name__ == "__main__":
    check_schema()
