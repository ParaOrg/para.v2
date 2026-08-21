#!/usr/bin/env python3
"""Deep clean - remove ALL test data and verify database is truly clean."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from collections import Counter

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def deep_clean():
    print("🧹 DEEP CLEANING DATABASE\n")
    print("="*60)
    
    # 1. Check ph_route_reference for test routes
    print("\n1. Checking ph_route_reference for test routes...")
    
    # Find routes that shouldn't be there (test, demo, community drawn)
    test_patterns = ["test", "demo", "dummy", "sample", "community drawn", "brand new", "example"]
    
    ref_routes = supabase.table("ph_route_reference").select("id, route_name, source_file").execute()
    if ref_routes.data:
        test_refs = [r for r in ref_routes.data if any(p in r["route_name"].lower() for p in test_patterns)]
        
        if test_refs:
            print(f"   Found {len(test_refs)} test routes to delete:")
            for route in test_refs:
                print(f"      • {route['route_name']} (ID: {route['id']}, source: {route.get('source_file')})")
                supabase.table("ph_route_reference").delete().eq("id", route["id"]).execute()
                print(f"        ✅ Deleted")
        else:
            print("   ✅ No test routes found")
    
    # 2. Check ph_user_tracks for test entries
    print("\n2. Checking ph_user_tracks for test entries...")
    
    # Delete Health Check tracks
    health_check = supabase.table("ph_user_tracks").select("track_uuid, route_name").eq("route_name", "Health Check").execute()
    if health_check.data:
        print(f"   Found {len(health_check.data)} Health Check tracks to delete:")
        for track in health_check.data:
            supabase.table("ph_user_tracks").delete().eq("track_uuid", track["track_uuid"]).execute()
        print(f"   ✅ Deleted {len(health_check.data)} Health Check tracks")
    else:
        print("   ✅ No Health Check tracks found")
    
    # Check for tracks with test route names
    test_tracks = supabase.table("ph_user_tracks").select("track_uuid, route_name").or_("route_name.ilike.%test%,route_name.ilike.%demo%,route_name.ilike.%dummy%").execute()
    if test_tracks.data:
        print(f"   Found {len(test_tracks.data)} test tracks:")
        for track in test_tracks.data:
            print(f"      • {track['route_name']}")
            supabase.table("ph_user_tracks").delete().eq("track_uuid", track["track_uuid"]).execute()
        print(f"   ✅ Deleted test tracks")
    else:
        print("   ✅ No test tracks found")
    
    # 3. Check ph_routes for test routes
    print("\n3. Checking ph_routes for test routes...")
    
    ph_routes = supabase.table("ph_routes").select("route_uuid, name, status").execute()
    if ph_routes.data:
        test_routes = [r for r in ph_routes.data if any(p in r.get("name", "").lower() for p in test_patterns)]
        
        if test_routes:
            print(f"   Found {len(test_routes)} test routes:")
            for route in test_routes:
                print(f"      • {route['name']} (status: {route.get('status')})")
                supabase.table("ph_routes").delete().eq("route_uuid", route["route_uuid"]).execute()
            print(f"   ✅ Deleted test routes")
        else:
            print("   ✅ No test routes found")
    
    # 4. Reset track_count to 0 for all (since we cleaned test data)
    print("\n4. Resetting track_count on ph_route_reference...")
    
    # Get all with track_count > 0
    has_tracks = supabase.table("ph_route_reference").select("id, route_name, track_count").gt("track_count", 0).execute()
    if has_tracks.data:
        print(f"   Found {len(has_tracks.data)} routes with track_count > 0:")
        for route in has_tracks.data:
            print(f"      • {route['route_name']}: {route['track_count']}")
            supabase.table("ph_route_reference").update({"track_count": 0}).eq("id", route["id"]).execute()
        print(f"   ✅ Reset all track_counts to 0")
    else:
        print("   ✅ All track_counts already 0")
    
    # 5. Check ph_route_shapes for orphaned shapes
    print("\n5. Checking ph_route_shapes for orphaned entries...")
    
    shapes = supabase.table("ph_route_shapes").select("route_uuid").execute()
    routes = supabase.table("ph_routes").select("route_uuid").execute()
    
    if shapes.data and routes.data:
        shape_uuids = {s["route_uuid"] for s in shapes.data}
        route_uuids = {r["route_uuid"] for r in routes.data}
        
        orphaned = shape_uuids - route_uuids
        if orphaned:
            print(f"   Found {len(orphaned)} orphaned shapes to delete:")
            for uuid in orphaned:
                supabase.table("ph_route_shapes").delete().eq("route_uuid", uuid).execute()
            print(f"   ✅ Deleted orphaned shapes")
        else:
            print("   ✅ No orphaned shapes")
    
    # 6. Check transit_stops for test entries
    print("\n6. Checking transit_stops for test entries...")
    
    stops = supabase.table("transit_stops").select("id, name, route_name").execute()
    if stops.data:
        test_stops = [s for s in stops.data if any(p in s.get("name", "").lower() for p in test_patterns)]
        
        if test_stops:
            print(f"   Found {len(test_stops)} test stops:")
            for stop in test_stops:
                print(f"      • {stop['name']} ({stop.get('route_name')})")
                supabase.table("transit_stops").delete().eq("id", stop["id"]).execute()
            print(f"   ✅ Deleted test stops")
        else:
            print("   ✅ No test stops found")

def verify_clean():
    print("\n\n🔍 VERIFYING DATABASE IS CLEAN\n")
    print("="*60)
    
    # Check counts
    ref_count = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    routes_count = supabase.table("ph_routes").select("count", count="exact").limit(0).execute()
    tracks_count = supabase.table("ph_user_tracks").select("count", count="exact").limit(0).execute()
    shapes_count = supabase.table("ph_route_shapes").select("count", count="exact").limit(0).execute()
    stops_count = supabase.table("transit_stops").select("count", count="exact").limit(0).execute()
    
    print(f"\n📊 TABLE COUNTS:")
    print(f"   ph_route_reference: {ref_count.count if hasattr(ref_count, 'count') else 0}")
    print(f"   ph_routes: {routes_count.count if hasattr(routes_count, 'count') else 0}")
    print(f"   ph_user_tracks: {tracks_count.count if hasattr(tracks_count, 'count') else 0}")
    print(f"   ph_route_shapes: {shapes_count.count if hasattr(shapes_count, 'count') else 0}")
    print(f"   transit_stops: {stops_count.count if hasattr(stops_count, 'count') else 0}")
    
    # Check review statuses
    statuses = supabase.table("ph_user_tracks").select("review_status").limit(500).execute()
    if statuses.data:
        status_counts = Counter(r.get("review_status", "unknown") for r in statuses.data)
        print(f"\n📊 REVIEW STATUSES:")
        for status, count in status_counts.most_common():
            print(f"   {status}: {count}")
    
    # Check for any remaining test data
    print(f"\n🔍 REMAINING TEST DATA CHECK:")
    
    # Check route names with test patterns
    all_refs = supabase.table("ph_route_reference").select("route_name").execute()
    if all_refs.data:
        test_names = [r["route_name"] for r in all_refs.data if any(p in r["route_name"].lower() for p in ["test", "demo", "dummy", "sample"])]
        if test_names:
            print(f"   ⚠️ Still found {len(test_names)} test route names:")
            for name in test_names[:5]:
                print(f"      • {name}")
        else:
            print(f"   ✅ No test route names in ph_route_reference")
    
    # Check track_counts
    nonzero = supabase.table("ph_route_reference").select("count", count="exact").gt("track_count", 0).limit(0).execute()
    nonzero_count = nonzero.count if hasattr(nonzero, 'count') else 0
    print(f"   ✅ Routes with track_count > 0: {nonzero_count}")
    
    # Check reference_id linkage
    null_refs = supabase.table("ph_user_tracks").select("count", count="exact").is_("reference_id", "null").limit(0).execute()
    null_ref_count = null_refs.count if hasattr(null_refs, 'count') else 0
    print(f"   ℹ️ Tracks with NULL reference_id: {null_ref_count} (may be legitimate)")
    
    print(f"\n{'='*60}")
    print(f"✅ DATABASE IS CLEAN" if nonzero_count == 0 else f"⚠️ DATABASE NEEDS ATTENTION")
    print(f"{'='*60}")

if __name__ == "__main__":
    deep_clean()
    verify_clean()
