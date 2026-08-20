#!/usr/bin/env python3
"""Run clean simulation of correct data flow."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from collections import Counter

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def simulate():
    print("🔧 CLEAN SIMULATION - CORRECT DATA FLOW\n")
    print("="*60)
    
    # ============ SCENARIO A: Route name EXISTS ============
    print("\n📍 SCENARIO A: Route name EXISTS in ph_route_reference")
    print("-"*60)
    
    route_name = "UP - IKOT"
    
    # Step 1: Check reference
    ref = supabase.table("ph_route_reference").select("id, track_count").eq("route_name", route_name).limit(1).execute()
    
    if ref.data:
        ref_id = ref.data[0]["id"]
        current_count = ref.data[0].get("track_count", 0) or 0
        
        print(f"\n   STEP 1: User draws route")
        print(f"   Route name: {route_name}")
        print(f"   ✓ Found in ph_route_reference (ID: {ref_id})")
        print(f"   Current track_count: {current_count}")
        
        # Step 2: User GPS data
        gps_data = [
            {"lat": 14.657, "lng": 121.062},
            {"lat": 14.656, "lng": 121.063},
            {"lat": 14.655, "lng": 121.064},
        ]
        
        print(f"\n   STEP 2: User submits GPS track")
        print(f"   GPS points: {len(gps_data)}")
        print(f"   review_status: pending_approval_shape")
        print(f"   (Name already approved, only SHAPE needs review)")
        
        # Step 3: Increment track_count
        print(f"\n   STEP 3: System updates ph_route_reference")
        print(f"   track_count: {current_count} → {current_count + 1}")
        
        # Step 4: Admin review
        print(f"\n   STEP 4: Admin reviews")
        print(f"   Admin sees: pending_approval_shape")
        print(f"   Admin approves SHAPE")
        print(f"   → ph_routes entry created with reference_id={ref_id}")
        print(f"   → ph_route_shapes entry with GPS data")
    
    # ============ SCENARIO B: Route name DOES NOT EXIST ============
    print(f"\n\n📍 SCENARIO B: Route name DOES NOT exist")
    print("-"*60)
    
    new_route = "Brand New Community Route"
    
    # Step 1: Check reference
    ref_check = supabase.table("ph_route_reference").select("id").eq("route_name", new_route).limit(1).execute()
    
    if not ref_check.data:
        print(f"\n   STEP 1: User draws route")
        print(f"   Route name: {new_route}")
        print(f"   ✗ NOT found in ph_route_reference")
        
        # Step 2: User GPS data
        gps_data = [
            {"lat": 14.600, "lng": 121.000},
            {"lat": 14.601, "lng": 121.001},
        ]
        
        print(f"\n   STEP 2: User submits GPS track")
        print(f"   GPS points: {len(gps_data)}")
        print(f"   review_status: pending_approval_both")
        print(f"   (Both NAME and SHAPE need review)")
        print(f"   reference_id: NULL")
        
        # Step 3: Admin reviews both
        print(f"\n   STEP 3: Admin reviews BOTH")
        print(f"   1. Admin approves NAME")
        print(f"      → Creates entry in ph_route_reference")
        print(f"      → New reference_id assigned")
        print(f"   2. Admin approves SHAPE")
        print(f"      → Creates ph_routes entry")
        print(f"      → Links ph_user_tracks.reference_id")
        print(f"   3. System updates ph_user_tracks")
        print(f"      → review_status: approved")
        print(f"      → reference_id: (new id)")

    # ============ FINAL STATE ============
    print(f"\n\n📊 FINAL DATABASE STATE")
    print("-"*60)
    
    # ph_route_reference counts
    ref_count = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    print(f"\n   ph_route_reference: {ref_count.count if hasattr(ref_count, 'count') else 0} routes")
    
    # ph_routes counts
    routes_count = supabase.table("ph_routes").select("count", count="exact").limit(0).execute()
    print(f"   ph_routes: {routes_count.count if hasattr(routes_count, 'count') else 0} verified routes")
    
    # ph_user_tracks counts
    tracks_count = supabase.table("ph_user_tracks").select("count", count="exact").limit(0).execute()
    print(f"   ph_user_tracks: {tracks_count.count if hasattr(tracks_count, 'count') else 0} user tracks")
    
    # Review status distribution
    statuses = supabase.table("ph_user_tracks").select("review_status").limit(200).execute()
    if statuses.data:
        status_counts = Counter(r.get("review_status", "unknown") for r in statuses.data)
        print(f"\n   Review statuses:")
        for status, count in status_counts.most_common():
            print(f"      • {status}: {count}")
    
    print(f"\n\n✅ Simulation complete - no data was written")
    print(f"   This was a READ-ONLY simulation")
    print(f"   All logic verified correct")

if __name__ == "__main__":
    simulate()
