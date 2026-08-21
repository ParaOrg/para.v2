#!/usr/bin/env python3
"""Create missing tables that the code references but don't exist in Supabase."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_and_create_missing():
    print("🔍 CHECKING MISSING TABLES\n")
    print("="*60)
    
    # Tables referenced in code but not found in Supabase
    missing_tables = [
        "community_route_edits",
        "community_route_edit_votes",
        "contact_messages",
        "articles",
        "telemetry_events",
        "traffic_news",
        "weather_alerts",
        "pagasa_advisories",
        "discovered_routes",
        "fare_reports",
        "ph_geocode_cache",
        "ph_place_aliases",
        "ph_places",
        "route_patterns",
    ]
    
    existing = []
    truly_missing = []
    
    for table in missing_tables:
        try:
            res = supabase.table(table).select("count", count="exact").limit(0).execute()
            count = res.count if hasattr(res, 'count') else 0
            existing.append((table, count))
            print(f"   ✅ {table}: EXISTS ({count} rows)")
        except:
            truly_missing.append(table)
            print(f"   ❌ {table}: MISSING")
    
    print(f"\n\n📊 RESULTS:")
    print(f"   Existing: {len(existing)}")
    print(f"   Truly missing: {len(truly_missing)}")
    
    if truly_missing:
        print(f"\n\n📝 SQL TO CREATE MISSING TABLES:")
        print("="*60)
        
        sql = """
-- Run these in Supabase SQL Editor:

-- Community route edits
CREATE TABLE IF NOT EXISTS community_route_edits (
    edit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_uuid UUID,
    edit_type TEXT,
    description TEXT,
    new_geometry JSONB,
    author_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community route edit votes
CREATE TABLE IF NOT EXISTS community_route_edit_votes (
    vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edit_id UUID,
    vote INTEGER,
    voter_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact messages
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE,
    title TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telemetry events
CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT,
    source TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Traffic news
CREATE TABLE IF NOT EXISTS traffic_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather alerts
CREATE TABLE IF NOT EXISTS weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    description TEXT,
    severity TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAGASA advisories
CREATE TABLE IF NOT EXISTS pagasa_advisories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovered routes
CREATE TABLE IF NOT EXISTS discovered_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fare reports
CREATE TABLE IF NOT EXISTS fare_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT,
    fare FLOAT,
    reported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geocode cache
CREATE TABLE IF NOT EXISTS ph_geocode_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT,
    lat FLOAT,
    lng FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Place aliases
CREATE TABLE IF NOT EXISTS ph_place_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias TEXT,
    place_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Places
CREATE TABLE IF NOT EXISTS ph_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    lat FLOAT,
    lng FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route patterns
CREATE TABLE IF NOT EXISTS route_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT,
    pattern TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""
        print(sql)
    
    return truly_missing

if __name__ == "__main__":
    missing = check_and_create_missing()
    
    print(f"\n\n📋 SUMMARY OF YOUR DATABASE:")
    print("="*60)
    print("""
    CORE TABLES (critical for routing):
    ✅ ph_route_reference (1034) - catalog of all routes
    ✅ ph_routes (48) - verified routes with GPS
    ✅ ph_route_shapes (48) - geometry data
    ✅ ph_user_tracks (0) - user GPS submissions
    ✅ transit_stops (80) - transit stops
    
    SUPPORT TABLES (in use):
    ✅ gas_stations (4) - gas price data
    ✅ waitlist (57) - user waitlist
    ✅ community_threads (2) - community posts
    ✅ community_comments (1) - community replies
    ✅ pwa_events (0) - PWA tracking
    
    MISSING TABLES (need to create):
    ❌ community_route_edits
    ❌ community_route_edit_votes
    ❌ contact_messages
    ❌ articles
    ❌ telemetry_events
    ❌ traffic_news
    ❌ weather_alerts
    ❌ pagasa_advisories
    ❌ discovered_routes
    ❌ fare_reports
    ❌ ph_geocode_cache
    ❌ ph_place_aliases
    ❌ ph_places
    ❌ route_patterns
    """)
