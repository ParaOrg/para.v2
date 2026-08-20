#!/usr/bin/env python3
"""Check all tables in Supabase and identify unused ones."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def list_all_tables():
    print("🔍 LISTING ALL TABLES IN SUPABASE\n")
    print("="*60)
    
    # Use PostgREST to list tables (via RPC or direct query)
    # Since we can't directly list tables, check common ones
    known_tables = [
        "ph_routes",
        "ph_route_reference", 
        "ph_user_tracks",
        "ph_route_shapes",
        "transit_stops",
        "poi",
        "pois",
        "gas_prices",
        "gas_stations",
        "waitlist",
        "community_threads",
        "community_comments",
        "community_route_edits",
        "community_route_edit_votes",
        "articles",
        "contact_messages",
        "pwa_events",
        "telemetry_events",
        "telemetry_pings",
        "traffic_news",
        "weather_alerts",
        "pagasa_advisories",
    ]
    
    existing_tables = []
    
    for table in known_tables:
        try:
            res = supabase.table(table).select("count", count="exact").limit(0).execute()
            count = res.count if hasattr(res, 'count') else 0
            existing_tables.append((table, count))
            print(f"   ✅ {table}: {count}")
        except Exception as e:
            print(f"   ❌ {table}: NOT FOUND")
    
    print(f"\n\n📊 EXISTING TABLES:")
    for table, count in existing_tables:
        print(f"   • {table}: {count} rows")
    
    return existing_tables

def check_table_usage():
    """Check which tables are actually referenced in the codebase."""
    
    print("\n\n🔍 CHECKING TABLE USAGE IN CODEBASE\n")
    print("="*60)
    
    import os
    import re
    
    # Tables found in code
    tables_in_code = set()
    
    # Search Python files
    for root, dirs, files in os.walk("."):
        if ".git" in root or "node_modules" in root or ".venv" in root:
            continue
        for file in files:
            if file.endswith((".py", ".js", ".jsx", ".ts", ".tsx")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Find supabase.table("...") references
                    matches = re.findall(r'supabase\.table\(["\']([^"\']+)["\']\)', content)
                    tables_in_code.update(matches)
                    
                    # Find fetch_all("...") references
                    matches2 = re.findall(r'fetch_all\(["\']([^"\']+)["\']', content)
                    tables_in_code.update(matches2)
                except:
                    pass
    
    print("Tables referenced in code:")
    for table in sorted(tables_in_code):
        print(f"   • {table}")
    
    return tables_in_code

def propose_cleanup(existing_tables, used_tables):
    """Propose which tables can be cleaned up."""
    
    print("\n\n🧹 CLEANUP PROPOSAL\n")
    print("="*60)
    
    existing_names = {table for table, _ in existing_tables}
    
    unused = existing_names - used_tables
    used = existing_names & used_tables
    
    print("✅ TABLES IN USE:")
    for table in sorted(used):
        count = [c for t, c in existing_tables if t == table][0]
        print(f"   • {table}: {count} rows")
    
    print("\n⚠️ TABLES NOT REFERENCED IN CODE (candidates for cleanup):")
    for table in sorted(unused):
        count = [c for t, c in existing_tables if t == table][0]
        print(f"   • {table}: {count} rows")
    
    print("\n📋 RECOMMENDATION:")
    print("   Tables with 0 rows and not referenced = SAFE TO DELETE")
    print("   Tables with rows but not referenced = REVIEW BEFORE DELETING")

if __name__ == "__main__":
    existing = list_all_tables()
    used = check_table_usage()
    propose_cleanup(existing, used)
