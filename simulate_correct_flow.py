#!/usr/bin/env python3
"""Simulate correct data flow with proper database design."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def simulate_user_tracking_flow():
    print("🔍 SIMULATING CORRECT USER TRACKING FLOW\n")
    print("="*60)
    
    # Scenario 1: User tracks route that EXISTS in ph_route_reference
    print("\n📋 SCENARIO 1: Route name exists in ph_route_reference")
    print("-"*40)
    
    route_name = "UP - IKOT"  # This exists in reference
    
    # Step 1: Check if route exists in ph_route_reference
    ref_check = supabase.table("ph_route_reference").select("id, route_name").eq("route_name", route_name).limit(1).execute()
    
    if ref_check.data:
        reference_id = ref_check.data[0]["id"]
        print(f"   ✅ Route found in ph_route_reference")
        print(f"      Reference ID: {reference_id}")
        
        # Step 2: User tracks GPS
        gps_points = [
            {"lat": 14.657, "lng": 121.062, "timestamp": "2026-08-20T10:00:00Z"},
            {"lat": 14.656, "lng": 121.063, "timestamp": "2026-08-20T10:01:00Z"},
            {"lat": 14.655, "lng": 121.064, "timestamp": "2026-08-20T10:02:00Z"},
        ]
        
        # Step 3: Save to ph_user_tracks with reference_id
        track = {
            "route_name": route_name,
            "reference_id": reference_id,  # Link to reference
            "gps_track": gps_points,
            "gps_points": len(gps_points),
            "status": "pending_approval_shape",  # Name exists, needs shape approval
        }
        
        print(f"   📍 User tracks GPS: {len(gps_points)} points")
        print(f"   💾 Saving to ph_user_tracks:")
        print(f"      - route_name: {route_name}")
        print(f"      - reference_id: {reference_id}")
        print(f"      - status: pending_approval_shape")
        print(f"      - (Name is approved, only shape needs verification)")
        
        # Step 4: Increment track_count on ph_route_reference
        print(f"   📊 Incrementing track_count on ph_route_reference")
        print(f"   ⏳ Waiting for admin to approve SHAPE only")
    
    # Scenario 2: User tracks route that DOES NOT exist
    print("\n\n📋 SCENARIO 2: Route name DOES NOT exist in ph_route_reference")
    print("-"*40)
    
    new_route_name = "New Community Route - User Drawn"
    
    ref_check2 = supabase.table("ph_route_reference").select("id").eq("route_name", new_route_name).limit(1).execute()
    
    if not ref_check2.data:
        print(f"   ❌ Route NOT found in ph_route_reference")
        
        # Step 1: Save to ph_user_tracks with no reference
        gps_points = [
            {"lat": 14.600, "lng": 121.000, "timestamp": "2026-08-20T10:00:00Z"},
            {"lat": 14.601, "lng": 121.001, "timestamp": "2026-08-20T10:01:00Z"},
        ]
        
        track = {
            "route_name": new_route_name,
            "reference_id": None,  # No reference yet
            "gps_track": gps_points,
            "gps_points": len(gps_points),
            "status": "pending_approval_both",  # Both name and shape need approval
        }
        
        print(f"   📍 User tracks GPS: {len(gps_points)} points")
        print(f"   💾 Saving to ph_user_tracks:")
        print(f"      - route_name: {new_route_name}")
        print(f"      - reference_id: None")
        print(f"      - status: pending_approval_both")
        print(f"      - (Both NAME and SHAPE need admin approval)")
        
        # Step 2: Admin reviews
        print(f"   👤 Admin reviews:")
        print(f"      1. Approves route name")
        print(f"      2. Creates entry in ph_route_reference")
        print(f"      3. Approves GPS shape")
        print(f"      4. Creates entry in ph_routes with reference_id")

def check_current_schema():
    print("\n\n🔍 CHECKING CURRENT SCHEMA\n")
    print("="*60)
    
    # Check ph_route_reference columns
    print("\n📋 ph_route_reference columns:")
    ref_sample = supabase.table("ph_route_reference").select("*").limit(1).execute()
    if ref_sample.data:
        for col in ref_sample.data[0].keys():
            print(f"   • {col}")
    
    # Check ph_user_tracks columns
    print("\n📋 ph_user_tracks columns:")
    track_sample = supabase.table("ph_user_tracks").select("*").limit(1).execute()
    if track_sample.data:
        for col in track_sample.data[0].keys():
            print(f"   • {col}")
    
    # Check ph_routes columns
    print("\n📋 ph_routes columns:")
    route_sample = supabase.table("ph_routes").select("*").limit(1).execute()
    if route_sample.data:
        for col in route_sample.data[0].keys():
            print(f"   • {col}")

def propose_schema_changes():
    print("\n\n🔧 PROPOSED SCHEMA CHANGES\n")
    print("="*60)
    
    print("""
    -- 1. ph_route_reference: Add track_count
    ALTER TABLE ph_route_reference 
    ADD COLUMN IF NOT EXISTS track_count INTEGER DEFAULT 0;
    
    -- 2. ph_user_tracks: Add reference_id (FK to ph_route_reference)
    ALTER TABLE ph_user_tracks 
    ADD COLUMN IF NOT EXISTS reference_id INTEGER REFERENCES ph_route_reference(id);
    
    -- 3. ph_user_tracks: Add approval_status
    ALTER TABLE ph_user_tracks 
    ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
    -- Values: 
    --   'pending_approval_shape' (name exists, shape needs review)
    --   'pending_approval_both' (name AND shape need review)
    --   'approved' (both approved)
    --   'rejected' (rejected)
    
    -- 4. ph_routes: Add reference_id (FK to ph_route_reference)
    ALTER TABLE ph_routes 
    ADD COLUMN IF NOT EXISTS reference_id INTEGER REFERENCES ph_route_reference(id);
    
    -- 5. ph_routes: Add shape_source
    ALTER TABLE ph_routes 
    ADD COLUMN IF NOT EXISTS shape_source TEXT;
    -- Values: 'user_track', 'csv_import', 'admin_drawn'
    """)

def simulate_admin_approval_flow():
    print("\n\n👤 SIMULATING ADMIN APPROVAL FLOW\n")
    print("="*60)
    
    print("""
    Scenario A: Route name exists, only shape needs approval
    ---------------------------------------------------------
    1. User tracks "UP - IKOT" (exists in reference)
    2. Data saved to ph_user_tracks with reference_id=123, status='pending_approval_shape'
    3. Admin sees pending track
    4. Admin approves SHAPE only
    5. System creates/updates ph_route_shapes with GPS data
    6. System updates ph_routes with shape reference
    7. Done - name was already approved
    
    Scenario B: New route, both name and shape need approval
    ---------------------------------------------------------
    1. User tracks "My New Route" (not in reference)
    2. Data saved to ph_user_tracks with reference_id=NULL, status='pending_approval_both'
    3. Admin sees pending track
    4. Admin approves NAME → creates entry in ph_route_reference
    5. Admin approves SHAPE → creates entry in ph_route_shapes
    6. System links ph_user_tracks.reference_id to new ph_route_reference.id
    7. System creates ph_routes entry with reference_id
    8. Done
    """)

def check_current_data_issues():
    print("\n\n⚠️ CURRENT DATA ISSUES\n")
    print("="*60)
    
    # Check if ph_user_tracks has reference_id
    track_sample = supabase.table("ph_user_tracks").select("*").limit(1).execute()
    if track_sample.data:
        has_reference_id = "reference_id" in track_sample.data[0]
        has_status = "status" in track_sample.data[0]
        print(f"   ph_user_tracks has reference_id: {has_reference_id}")
        print(f"   ph_user_tracks has status: {has_status}")
    
    # Check if ph_route_reference has track_count
    ref_sample = supabase.table("ph_route_reference").select("*").limit(1).execute()
    if ref_sample.data:
        has_track_count = "track_count" in ref_sample.data[0]
        print(f"   ph_route_reference has track_count: {has_track_count}")
    
    # Check if ph_routes has reference_id
    route_sample = supabase.table("ph_routes").select("*").limit(1).execute()
    if route_sample.data:
        has_reference_id = "reference_id" in route_sample.data[0]
        has_shape_source = "shape_source" in route_sample.data[0]
        print(f"   ph_routes has reference_id: {has_reference_id}")
        print(f"   ph_routes has shape_source: {has_shape_source}")

if __name__ == "__main__":
    simulate_user_tracking_flow()
    check_current_schema()
    propose_schema_changes()
    simulate_admin_approval_flow()
    check_current_data_issues()
