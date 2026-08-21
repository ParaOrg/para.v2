#!/usr/bin/env python3
"""Clean up test data from simulations and reset track_count."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def cleanup():
    print("🧹 CLEANING UP TEST DATA\n")
    print("="*60)
    
    # 1. Delete test entry from ph_route_reference (Community Drawn Route)
    print("\n1. Removing test route from ph_route_reference...")
    ref_res = supabase.table("ph_route_reference").delete().eq("route_name", "Community Drawn Route - Example").execute()
    print(f"   ✅ Deleted test reference route")
    
    # 2. Reset track_count on UP - IKOT (was incremented during simulation)
    print("\n2. Resetting track_count on UP - IKOT...")
    supabase.table("ph_route_reference").update({"track_count": 0}).eq("id", 6415).execute()
    print(f"   ✅ Reset track_count to 0")
    
    # 3. Check for any other test data
    print("\n3. Checking for other test data...")
    
    # Check ph_user_tracks for test entries
    tracks = supabase.table("ph_user_tracks").select("track_uuid, route_name, review_status").eq("review_status", "pending_approval_shape").execute()
    if tracks.data:
        for track in tracks.data:
            print(f"   ⚠️ Found test track: {track.get('route_name')}")
    
    tracks2 = supabase.table("ph_user_tracks").select("track_uuid, route_name, review_status").eq("review_status", "pending_approval_both").execute()
    if tracks2.data:
        for track in tracks2.data:
            print(f"   ⚠️ Found test track: {track.get('route_name')}")
    
    # Check for any NULL reference_id tracks that shouldn't exist
    null_ref = supabase.table("ph_user_tracks").select("track_uuid, route_name").is_("reference_id", "null").limit(10).execute()
    if null_ref.data:
        print(f"\n   Tracks with NULL reference_id:")
        for track in null_ref.data:
            print(f"      • {track.get('route_name')}")
    
    print("\n✅ Cleanup complete")

if __name__ == "__main__":
    cleanup()
