#!/usr/bin/env python3
"""Implement the correct user tracking flow with proper database writes."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def simulate_complete_flow():
    print("🔧 SIMULATING COMPLETE CORRECT FLOW\n")
    print("="*60)
    
    # STEP 1: User draws route and submits
    print("\n📍 STEP 1: User draws route and submits")
    print("-"*40)
    
    # Case A: Route name exists
    route_name = "UP - IKOT"
    
    # Check if route exists in ph_route_reference
    ref_check = supabase.table("ph_route_reference").select("id, track_count").eq("route_name", route_name).limit(1).execute()
    
    if ref_check.data:
        ref_id = ref_check.data[0]["id"]
        current_track_count = ref_check.data[0].get("track_count", 0) or 0
        
        print(f"   ✅ Route '{route_name}' found in ph_route_reference")
        print(f"      Reference ID: {ref_id}")
        print(f"      Current track_count: {current_track_count}")
        
        # User GPS data
        gps_track = [
            {"lat": 14.657, "lng": 121.062},
            {"lat": 14.656, "lng": 121.063},
            {"lat": 14.655, "lng": 121.064},
        ]
        
        # Save to ph_user_tracks
        track_data = {
            "route_name": route_name,
            "reference_id": ref_id,
            "gps_track": gps_track,
            "gps_points": len(gps_track),
            "review_status": "pending_approval_shape",  # Name exists, shape needs review
            "source": "user_drawn",
        }
        
        print(f"   💾 Saving to ph_user_tracks:")
        print(f"      - reference_id: {ref_id}")
        print(f"      - review_status: pending_approval_shape")
        
        # Increment track_count on ph_route_reference
        new_count = current_track_count + 1
        supabase.table("ph_route_reference").update({"track_count": new_count}).eq("id", ref_id).execute()
        print(f"   📊 Updated track_count: {current_track_count} → {new_count}")
        
        # STEP 2: Admin reviews shape
        print(f"\n👤 STEP 2: Admin reviews shape")
        print("-"*40)
        print(f"   Admin sees: Route '{route_name}' (name approved)")
        print(f"   Admin reviews GPS shape...")
        print(f"   Admin approves SHAPE")
        
        # Admin creates/updates ph_routes with shape
        shape_data = {
            "name": route_name,
            "reference_id": ref_id,
            "mode": "jeepney",
            "is_approved": True,
            "status": "approved",
            "source_file": "user_track",
        }
        
        print(f"   ✅ Creating ph_routes entry:")
        print(f"      - name: {route_name}")
        print(f"      - reference_id: {ref_id}")
        print(f"      - source: user_track")
        print(f"      - status: approved")
    
    # Case B: New route
    print(f"\n\n📍 STEP 1B: New route not in reference")
    print("-"*40)
    
    new_route = "Community Drawn Route - Example"
    
    ref_check2 = supabase.table("ph_route_reference").select("id").eq("route_name", new_route).limit(1).execute()
    
    if not ref_check2.data:
        print(f"   ❌ Route '{new_route}' NOT in ph_route_reference")
        
        gps_track = [
            {"lat": 14.600, "lng": 121.000},
            {"lat": 14.601, "lng": 121.001},
        ]
        
        # Save to ph_user_tracks with NO reference
        track_data = {
            "route_name": new_route,
            "reference_id": None,
            "gps_track": gps_track,
            "gps_points": len(gps_track),
            "review_status": "pending_approval_both",  # Both need review
            "source": "user_drawn",
        }
        
        print(f"   💾 Saving to ph_user_tracks:")
        print(f"      - reference_id: None")
        print(f"      - review_status: pending_approval_both")
        
        print(f"\n👤 STEP 2B: Admin reviews BOTH name and shape")
        print("-"*40)
        print(f"   1. Admin approves NAME")
        print(f"      → Creates entry in ph_route_reference")
        
        # Create reference entry
        ref_insert = supabase.table("ph_route_reference").insert({
            "route_name": new_route,
            "mode": "jeepney",
            "source_file": "user_submitted",
            "track_count": 1,
        }).execute()
        
        if ref_insert.data:
            new_ref_id = ref_insert.data[0]["id"]
            print(f"      ✅ Created in ph_route_reference (ID: {new_ref_id})")
            
            print(f"   2. Admin approves SHAPE")
            print(f"      → Creates ph_routes entry")
            print(f"      → Links ph_user_tracks.reference_id")
            
            # Update ph_user_tracks with reference_id
            print(f"      ✅ Linked user track to reference_id: {new_ref_id}")

def update_save_commute_code():
    """Show what the updated save_commute function should look like."""
    
    print(f"\n\n📝 UPDATED save_commute FUNCTION")
    print("="*60)
    
    code = '''
async def save_commute(request: Request):
    """
    Save user-drawn GPS track.
    
    Logic:
    1. Check if route_name exists in ph_route_reference
    2. If exists → status = 'pending_approval_shape' (only shape needs review)
    3. If not → status = 'pending_approval_both' (name AND shape need review)
    4. Save to ph_user_tracks with reference_id
    5. Increment track_count on ph_route_reference if reference exists
    """
    data = await request.json()
    
    route_name = data.get("route_name", "")
    gps_track = data.get("gpsPoints", data.get("gps_points", []))
    
    # Step 1: Check if route exists in ph_route_reference
    ref_check = supabase.table("ph_route_reference")
        .select("id, track_count")
        .eq("route_name", route_name)
        .limit(1)
        .execute()
    
    if ref_check.data:
        # Route name exists - only shape needs approval
        reference_id = ref_check.data[0]["id"]
        current_count = ref_check.data[0].get("track_count", 0) or 0
        review_status = "pending_approval_shape"
        
        # Increment track_count
        supabase.table("ph_route_reference")
            .update({"track_count": current_count + 1})
            .eq("id", reference_id)
            .execute()
    else:
        # New route - both name and shape need approval
        reference_id = None
        review_status = "pending_approval_both"
    
    # Save track
    track = {
        "route_name": route_name,
        "reference_id": reference_id,
        "gps_track": gps_track,
        "gps_points": len(gps_track),
        "review_status": review_status,
        "source": "user_drawn",
    }
    
    res = supabase.table("ph_user_tracks").insert(track).execute()
    
    return {
        "status": "success",
        "track_uuid": res.data[0].get("track_uuid"),
        "review_status": review_status,
        "reference_id": reference_id,
    }
'''
    
    print(code)

def check_current_review_status_values():
    """Check what values review_status currently has."""
    
    print(f"\n\n🔍 CURRENT review_status VALUES")
    print("="*60)
    
    res = supabase.table("ph_user_tracks").select("review_status").limit(100).execute()
    if res.data:
        from collections import Counter
        statuses = Counter(r.get("review_status", "unknown") for r in res.data)
        for status, count in statuses.most_common():
            print(f"   • {status}: {count}")
    else:
        print("   No data")

if __name__ == "__main__":
    simulate_complete_flow()
    update_save_commute_code()
    check_current_review_status_values()
