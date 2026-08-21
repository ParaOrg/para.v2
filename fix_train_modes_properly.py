#!/usr/bin/env python3
"""Fix train modes using correct enum values."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_mode_enum():
    print("🔍 Checking valid modes in ph_routes...\n")
    
    # Get all distinct modes
    res = supabase.table("ph_routes").select("mode").execute()
    if res.data:
        modes = {}
        for r in res.data:
            mode = r.get("mode")
            if mode:
                modes[mode] = modes.get(mode, 0) + 1
        
        print("Valid modes in ph_routes:")
        for mode, count in sorted(modes.items()):
            print(f"   • {mode}: {count}")
    
    # Check graph_engine.py to see what modes it expects
    print("\n🔍 Checking graph_engine.py for mode values...")
    import subprocess
    result = subprocess.run(["grep", "-n", "mode", "graph_engine.py"], 
                          capture_output=True, text=True)
    for line in result.stdout.split('\n')[:30]:
        if 'mode' in line.lower() and ('train' in line.lower() or 'rail' in line.lower() or 'jeep' in line.lower()):
            print(f"   {line.strip()[:100]}")

if __name__ == "__main__":
    check_mode_enum()
