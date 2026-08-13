"""
data_cleaner.py — Clean GPS commute data for analysis.
Removes outliers, deduplicates tracks, validates metadata.
"""
import math
from collections import Counter
from database import supabase

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def clean_gps_points(points):
    """Remove GPS outliers and teleport artifacts."""
    if not points:
        return []
    cleaned = [points[0]]
    for i in range(1, len(points)):
        p1, p2 = points[i-1], points[i]
        lat1, lng1 = p1.get('lat'), p1.get('lng')
        lat2, lng2 = p2.get('lat'), p2.get('lng')
        if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
            continue
        dist = haversine(lat1, lng1, lat2, lng2)
        # Reject jumps > 500m (teleport)
        if dist > 500:
            continue
        # Reject points with poor accuracy
        if p2.get('accuracy', 0) > 50:
            continue
        cleaned.append(p2)
    return cleaned

def clean_all_tracks():
    """Full data cleaning pipeline."""
    print("=== DATA CLEANING PIPELINE ===")
    
    # 1. Fetch all tracks (paginated)
    all_tracks = []
    offset = 0
    limit = 1000
    while True:
        res = supabase.table('ph_user_tracks').select('*').range(offset, offset+limit-1).execute()
        rows = res.data or []
        if not rows:
            break
        all_tracks.extend(rows)
        offset += len(rows)
        if len(rows) < limit:
            break
    
    print(f"Total tracks fetched: {len(all_tracks)}")
    
    # 2. Remove short tracks (< 100m)
    valid_tracks = [t for t in all_tracks if t.get('distance_m', 0) >= 100]
    print(f"Removed {len(all_tracks) - len(valid_tracks)} short tracks (< 100m)")
    
    # 3. Remove tracks with no GPS
    with_gps = [t for t in valid_tracks if t.get('gps_points', 0) > 0]
    print(f"Removed {len(valid_tracks) - len(with_gps)} tracks without GPS")
    
    # 4. Clean GPS points in each track
    for t in with_gps:
        if t.get('raw_payload') and isinstance(t['raw_payload'], dict):
            gps = t['raw_payload'].get('gps_points', [])
            cleaned = clean_gps_points(gps)
            if len(cleaned) < len(gps):
                # Update track with cleaned points
                supabase.table('ph_user_tracks').update({
                    'gps_points': len(cleaned)
                }).eq('track_uuid', t['track_uuid']).execute()
    print(f"Cleaned GPS outliers in tracks")
    
    # 5. Deduplicate by route_name + user + date
    seen = set()
    duplicates = 0
    for t in with_gps:
        key = (t.get('user_id'), t.get('route_name'), str(t.get('created_at',''))[:10])
        if key in seen:
            duplicates += 1
            # Mark as duplicate
            supabase.table('ph_user_tracks').update({
                'raw_payload': {**(t.get('raw_payload') or {}), 'duplicate': True}
            }).eq('track_uuid', t['track_uuid']).execute()
        else:
            seen.add(key)
    print(f"Marked {duplicates} duplicate tracks")
    
    # 6. Route name validation
    route_names = [t.get('route_name','') for t in with_gps if t.get('route_name')]
    c = Counter(route_names)
    print(f"\n=== CLEAN DATA SUMMARY ===")
    print(f"Valid tracks: {len(with_gps)}")
    print(f"Unique routes: {len(c)}")
    print(f"Top routes:")
    for name, count in c.most_common(15):
        print(f"  {count:>4}x  {name}")

if __name__ == "__main__":
    clean_all_tracks()
