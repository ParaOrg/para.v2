#!/usr/bin/env python3
"""Complete database check - all tables, counts, and data quality."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from collections import Counter

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_table(table_name, description=""):
    """Check a table's count and sample data."""
    try:
        res = supabase.table(table_name).select("count", count="exact").limit(0).execute()
        count = res.count if hasattr(res, 'count') else 0
        print(f"\n{'='*60}")
        print(f"📋 {table_name} {description}")
        print(f"{'='*60}")
        print(f"   Rows: {count}")
        
        # Get sample
        sample = supabase.table(table_name).select("*").limit(1).execute()
        if sample.data:
            print(f"   Columns:")
            for key in sample.data[0].keys():
                print(f"      • {key}")
        
        return count
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"📋 {table_name} {description}")
        print(f"{'='*60}")
        print(f"   ⚠️ Error: {e}")
        return 0

def check_ph_route_reference():
    """Detailed check of ph_route_reference."""
    print(f"\n{'='*60}")
    print("📋 ph_route_reference - DETAILED")
    print(f"{'='*60}")
    
    # Total count
    total = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    print(f"   Total routes: {total_count}")
    
    # Mode distribution
    print(f"\n   Mode distribution:")
    modes = supabase.table("ph_route_reference").select("mode").execute()
    if modes.data:
        mode_counts = Counter(r.get("mode", "unknown") for r in modes.data)
        for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
            print(f"      {mode}: {count}")
    
    # Source files
    print(f"\n   Source files:")
    sources = supabase.table("ph_route_reference").select("source_file").execute()
    if sources.data:
        source_counts = Counter(r.get("source_file", "unknown") for r in sources.data)
        for source, count in sorted(source_counts.items(), key=lambda x: -x[1]):
            print(f"      {source}: {count}")
    
    # Missing origins/destinations
    null_origin = supabase.table("ph_route_reference").select("count", count="exact").is_("origin", "null").limit(0).execute()
    null_dest = supabase.table("ph_route_reference").select("count", count="exact").is_("destination", "null").limit(0).execute()
    
    null_origin_count = null_origin.count if hasattr(null_origin, 'count') else 0
    null_dest_count = null_dest.count if hasattr(null_dest, 'count') else 0
    
    print(f"\n   Data quality:")
    print(f"      Missing origin: {null_origin_count}")
    print(f"      Missing destination: {null_dest_count}")

def check_ph_routes():
    """Detailed check of ph_routes."""
    print(f"\n{'='*60}")
    print("📋 ph_routes - DETAILED")
    print(f"{'='*60}")
    
    # Total
    total = supabase.table("ph_routes").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    print(f"   Total routes: {total_count}")
    
    # By mode
    modes = supabase.table("ph_routes").select("mode").execute()
    if modes.data:
        mode_counts = Counter(r.get("mode", "unknown") for r in modes.data)
        print(f"\n   Mode distribution:")
        for mode, count in sorted(mode_counts.items(), key=lambda x: -x[1]):
            print(f"      {mode}: {count}")
    
    # By status
    statuses = supabase.table("ph_routes").select("status").execute()
    if statuses.data:
        status_counts = Counter(r.get("status", "unknown") for r in statuses.data)
        print(f"\n   Status distribution:")
        for status, count in sorted(status_counts.items(), key=lambda x: -x[1]):
            print(f"      {status}: {count}")
    
    # Approved count
    approved = supabase.table("ph_routes").select("count", count="exact").eq("is_approved", True).limit(0).execute()
    approved_count = approved.count if hasattr(approved, 'count') else 0
    print(f"\n   Approved: {approved_count}")
    
    # Sample routes
    print(f"\n   Sample routes:")
    sample = supabase.table("ph_routes").select("name, mode, status, is_approved").limit(10).execute()
    if sample.data:
        for route in sample.data:
            print(f"      • {route.get('name')} ({route.get('mode')}, {route.get('status')})")

def check_ph_user_tracks():
    """Check user tracks table."""
    print(f"\n{'='*60}")
    print("📋 ph_user_tracks")
    print(f"{'='*60}")
    
    total = supabase.table("ph_user_tracks").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    print(f"   Total tracks: {total_count}")
    
    if total_count > 0:
        sample = supabase.table("ph_user_tracks").select("*").limit(1).execute()
        if sample.data:
            print(f"   Columns:")
            for key in sample.data[0].keys():
                print(f"      • {key}")

def check_ph_route_shapes():
    """Check route shapes table."""
    print(f"\n{'='*60}")
    print("📋 ph_route_shapes")
    print(f"{'='*60}")
    
    total = supabase.table("ph_route_shapes").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    print(f"   Total shapes: {total_count}")

def check_transit_stops():
    """Check transit stops."""
    print(f"\n{'='*60}")
    print("📋 transit_stops")
    print(f"{'='*60}")
    
    total = supabase.table("transit_stops").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    print(f"   Total stops: {total_count}")
    
    # By vehicle type
    types = supabase.table("transit_stops").select("vehicle_type").execute()
    if types.data:
        type_counts = Counter(r.get("vehicle_type", "unknown") for r in types.data)
        print(f"\n   Vehicle types:")
        for vtype, count in sorted(type_counts.items()):
            print(f"      {vtype}: {count}")
    
    # Train lines
    train_stops = supabase.table("transit_stops").select("route_name").eq("vehicle_type", "train").execute()
    if train_stops.data:
        line_counts = Counter(r.get("route_name", "unknown") for r in train_stops.data)
        print(f"\n   Train lines:")
        for line, count in sorted(line_counts.items()):
            print(f"      {line}: {count} stops")

def main():
    print("🔍 FULL DATABASE CHECK\n")
    
    # Check all tables
    check_ph_route_reference()
    check_ph_routes()
    check_ph_user_tracks()
    check_ph_route_shapes()
    check_transit_stops()
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    
    ref_total = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    routes_total = supabase.table("ph_routes").select("count", count="exact").limit(0).execute()
    tracks_total = supabase.table("ph_user_tracks").select("count", count="exact").limit(0).execute()
    shapes_total = supabase.table("ph_route_shapes").select("count", count="exact").limit(0).execute()
    stops_total = supabase.table("transit_stops").select("count", count="exact").limit(0).execute()
    
    print(f"   ph_route_reference: {ref_total.count if hasattr(ref_total, 'count') else 0}")
    print(f"   ph_routes: {routes_total.count if hasattr(routes_total, 'count') else 0}")
    print(f"   ph_user_tracks: {tracks_total.count if hasattr(tracks_total, 'count') else 0}")
    print(f"   ph_route_shapes: {shapes_total.count if hasattr(shapes_total, 'count') else 0}")
    print(f"   transit_stops: {stops_total.count if hasattr(stops_total, 'count') else 0}")

if __name__ == "__main__":
    main()
