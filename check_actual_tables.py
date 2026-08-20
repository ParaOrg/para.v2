#!/usr/bin/env python3
"""Check all actual tables against codebase usage."""

import os
import re
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Your actual tables from Supabase
actual_tables = [
    "ph_route_reference",
    "vehicle",
    "ph_user_profiles",
    "route_patterns",
    "rating",
    "trips",
    "driver",
    "community_threads",
    "Bus",
    "discovered_routes",
    "ph_routes",
    "route_edits",
    "transit_stops",
    "route_edit_votes",
    "converstation",
    "community_advisories",
    "train",
    "admin",
    "user",
    "jeepney",
    "commuter",
    "route_id",
    "waitlist",
    "gas_price_updates",
    "gas_stations",
    "station_community_prices",
    "route_generation_jobs",
    "user_challenges",
    "challenges",
    "user_contributions",
    "achievements",
    "memory_revisions",
    "user_achievements",
    "agent_sessions",
    "session_messages",
    "audit_logs",
    "token_usage_daily",
    "cost_alerts",
    "fare_reports",
    "spatial_ref_sys",
    "geography_columns",
    "geometry_columns",
    "ph_route_shapes",
    "ph_places",
    "ph_place_aliases",
    "ph_geocode_cache",
    "ph_user_tracks",
    "ph_route_photos",
    "community_comments",
    "ph_admin_users",
    "poi_jeepney_terminals",
    "poi_uv_terminals",
    "poi_lrt_stations",
    "poi_mrt_stations",
    "poi_pnr_stations",
    "poi_bus_terminals",
    "pwa_events",
]

def check_counts():
    print("🔍 CHECKING ALL ACTUAL TABLES\n")
    print("="*60)
    
    results = {}
    
    for table in actual_tables:
        try:
            res = supabase.table(table).select("count", count="exact").limit(0).execute()
            count = res.count if hasattr(res, 'count') else 0
            results[table] = count
            print(f"   ✅ {table}: {count}")
        except Exception as e:
            results[table] = None
            print(f"   ❌ {table}: ERROR - {str(e)[:80]}")
    
    return results

def check_code_usage():
    print("\n\n🔍 CHECKING CODE REFERENCES\n")
    print("="*60)
    
    # Find all table references in code
    tables_in_code = set()
    
    for root, dirs, files in os.walk("."):
        if ".git" in root or "node_modules" in root or ".venv" in root or "scripts/.venv" in root:
            continue
        for file in files:
            if file.endswith((".py", ".js", ".jsx", ".ts", ".tsx")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # supabase.table("...")
                    matches = re.findall(r'supabase\.table\(["\']([^"\']+)["\']\)', content)
                    tables_in_code.update(matches)
                    
                    # fetch_all("...")
                    matches2 = re.findall(r'fetch_all\(["\']([^"\']+)["\']', content)
                    tables_in_code.update(matches2)
                    
                    # table name = "..."
                    matches3 = re.findall(r'table_name\s*=\s*["\']([^"\']+)["\']', content)
                    tables_in_code.update(matches3)
                except:
                    pass
    
    print(f"Tables referenced in code: {len(tables_in_code)}")
    for table in sorted(tables_in_code):
        print(f"   • {table}")
    
    return tables_in_code

def analyze():
    counts = check_counts()
    used_tables = check_code_usage()
    
    print("\n\n🧹 CLEANUP ANALYSIS\n")
    print("="*60)
    
    # Categorize
    core = []
    used = []
    unused = []
    system = []
    
    for table in actual_tables:
        count = counts.get(table, 0)
        
        # System tables (PostGIS/Supabase internals)
        if table in ["spatial_ref_sys", "geography_columns", "geometry_columns"]:
            system.append((table, count))
        # Core routing tables
        elif table in ["ph_route_reference", "ph_routes", "ph_route_shapes", "ph_user_tracks", "transit_stops"]:
            core.append((table, count))
        # Used in code
        elif table in used_tables:
            used.append((table, count))
        # Not used in code
        else:
            unused.append((table, count))
    
    print("\n🔴 CORE ROUTING TABLES:")
    for table, count in core:
        print(f"   • {table}: {count} rows")
    
    print("\n✅ TABLES USED IN CODE:")
    for table, count in used:
        print(f"   • {table}: {count} rows")
    
    print("\n⚠️ TABLES NOT REFERENCED IN CODE:")
    for table, count in unused:
        print(f"   • {table}: {count} rows")
    
    print("\n🔧 SYSTEM TABLES (DO NOT TOUCH):")
    for table, count in system:
        print(f"   • {table}: {count} rows")
    
    print("\n\n📋 RECOMMENDATIONS:")
    print("="*60)
    
    # Tables with 0 rows and unused
    empty_unused = [(t, c) for t, c in unused if c == 0]
    empty_used = [(t, c) for t, c in used if c == 0]
    populated_unused = [(t, c) for t, c in unused if c and c > 0]
    
    if empty_unused:
        print(f"\n🗑️ SAFE TO DELETE (0 rows, not in code): {len(empty_unused)} tables")
        for table, count in empty_unused:
            print(f"   • {table}")
    
    if empty_used:
        print(f"\n⚠️ EMPTY BUT REFERENCED IN CODE: {len(empty_used)} tables")
        for table, count in empty_used:
            print(f"   • {table} (keep - code expects it)")
    
    if populated_unused:
        print(f"\n🚨 POPULATED BUT NOT REFERENCED: {len(populated_unused)} tables")
        print("   (Review before deleting - may have data you need)")
        for table, count in populated_unused[:10]:
            print(f"   • {table}: {count} rows")

if __name__ == "__main__":
    analyze()
