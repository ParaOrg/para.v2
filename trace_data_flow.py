#!/usr/bin/env python3
"""Trace exactly where user tracking data goes."""

import re

def trace_backend_flow():
    print("🔍 TRACING BACKEND DATA FLOW\n")
    print("="*60)
    
    # Check api_routes.py for save endpoints
    print("\n1. BACKEND ENDPOINTS (api_routes.py)")
    print("-"*40)
    
    with open("api_routes.py", "r") as f:
        content = f.read()
    
    # Find all POST endpoints
    post_routes = re.findall(r'@router\.post\("([^"]+)"\)', content)
    print("POST endpoints:")
    for route in post_routes:
        print(f"   • {route}")
    
    # Find save_commute function
    save_commute_match = re.search(r'async def save_commute.*?(?=@router|\Z)', content, re.DOTALL)
    if save_commute_match:
        print("\n   save_commute function:")
        func_code = save_commute_match.group(0)
        print(func_code[:1000])
    
    # Find track_pwa_event
    track_pwa_match = re.search(r'async def track_pwa_event.*?(?=@router|\Z)', content, re.DOTALL)
    if track_pwa_match:
        print("\n   track_pwa_event function:")
        func_code = track_pwa_match.group(0)
        print(func_code[:800])

def trace_frontend_flow():
    print("\n\n2. FRONTEND TRACKING FLOW")
    print("-"*40)
    
    # Check LiveRouteRecorder.jsx
    print("\n   LiveRouteRecorder.jsx:")
    with open("src/components/LiveRouteRecorder.jsx", "r") as f:
        content = f.read()
    
    # Find where it saves
    save_patterns = re.findall(r'(edgePost|apiPost|fetch|offlineBuffer|supabase).*?\(', content)
    if save_patterns:
        for pattern in set(save_patterns[:10]):
            print(f"      • {pattern}")
    
    # Find the actual save call
    save_match = re.search(r'edgePost\("([^"]+)".*?,\s*(\{.*?\})\)', content, re.DOTALL)
    if save_match:
        print(f"\n      Endpoint: {save_match.group(1)}")
        print(f"      Payload: {save_match.group(2)[:200]}")
    
    # Check InlineRecorder.jsx
    print("\n   InlineRecorder.jsx:")
    with open("src/components/InlineRecorder.jsx", "r") as f:
        content = f.read()
    
    save_match2 = re.search(r'edgePost\("([^"]+)".*?,\s*(\{.*?\})\)', content, re.DOTALL)
    if save_match2:
        print(f"      Endpoint: {save_match2.group(1)}")
        print(f"      Payload: {save_match2.group(2)[:200]}")

def trace_sync_engine():
    print("\n\n3. SYNC ENGINE (offline → online)")
    print("-"*40)
    
    with open("src/utils/syncEngine.js", "r") as f:
        content = f.read()
    
    # Find API calls
    api_calls = re.findall(r'(apiPost|edgePost|fetch)\(\s*["\']([^"\']+)["\']', content)
    if api_calls:
        for method, endpoint in api_calls:
            print(f"   • {method} → {endpoint}")
    
    # Find what data is sent
    sync_match = re.search(r'apiPost\("([^"]+)".*?,\s*(\{.*?\})\)', content, re.DOTALL)
    if sync_match:
        print(f"\n   Sync endpoint: {sync_match.group(1)}")
        print(f"   Data: {sync_match.group(2)[:300]}")

def trace_database_tables():
    print("\n\n4. DATABASE TABLES USED")
    print("-"*40)
    
    tables = [
        "ph_route_reference",  # Catalog
        "ph_routes",           # Verified routes
        "ph_user_tracks",      # User GPS tracks
        "ph_route_shapes",     # Route geometry
        "transit_stops",       # Transit stops
    ]
    
    for table in tables:
        print(f"   • {table}")
    
    print("""
    FLOW:
    
    User tracks GPS
        ↓
    LiveRouteRecorder / InlineRecorder (collects points)
        ↓
    offlineBuffer (queues locally)
        ↓
    syncEngine (syncs when online)
        ↓
    POST /commute/save or /save_commute
        ↓
    api_routes.py → save_commute()
        ↓
    ph_user_tracks (raw GPS data)
        ↓
    Admin reviews
        ↓
    ph_routes (verified, approved routes)
    """)

def check_actual_endpoints():
    print("\n\n5. CHECKING ACTUAL ENDPOINT MAPPINGS")
    print("-"*40)
    
    # Check what /commute/save actually does
    with open("api_routes.py", "r") as f:
        content = f.read()
    
    # Find the endpoint that handles /commute/save
    commute_match = re.search(r'@router\.post\("/commute/save"\).*?(?=@router|\Z)', content, re.DOTALL)
    if commute_match:
        print("\n   /commute/save handler:")
        print(commute_match.group(0)[:500])
    
    # Check /save_commute
    save_commute_match = re.search(r'@router\.post\("/save_commute"\).*?(?=@router|\Z)', content, re.DOTALL)
    if save_commute_match:
        print("\n   /save_commute handler:")
        print(save_commute_match.group(0)[:500])

if __name__ == "__main__":
    trace_backend_flow()
    trace_frontend_flow()
    trace_sync_engine()
    trace_database_tables()
    check_actual_endpoints()
