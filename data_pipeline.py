"""
data_pipeline.py — Complete data gathering and cleaning for Para PH.
Run: python3 data_pipeline.py
"""
import json
import math
import uuid
from collections import Counter
from datetime import datetime, timedelta
from database import supabase

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def fetch_all(table, batch_size=1000):
    """Fetch all rows from a table using pagination."""
    all_rows = []
    offset = 0
    while True:
        res = supabase.table(table).select('*').range(offset, offset+batch_size-1).execute()
        rows = res.data or []
        if not rows:
            break
        all_rows.extend(rows)
        offset += len(rows)
        if len(rows) < batch_size:
            break
    return all_rows

def clean_gps_track(points):
    """Remove outliers, teleports, and poor accuracy points."""
    if not points:
        return []
    cleaned = []
    for i, p in enumerate(points):
        lat = p.get('lat')
        lng = p.get('lng')
        if lat is None or lng is None:
            continue
        # Skip poor accuracy
        if p.get('accuracy', 0) > 50:
            continue
        # Check jump from last point
        if cleaned:
            last = cleaned[-1]
            dist = haversine(last['lat'], last['lng'], lat, lng)
            if dist > 500:  # Teleport
                continue
        cleaned.append({'lat': lat, 'lng': lng, 'timestamp': p.get('timestamp')})
    return cleaned

def deduplicate_tracks(tracks):
    """Mark duplicate tracks (same user, route, date)."""
    seen = {}
    duplicates = []
    for t in tracks:
        key = (t.get('user_id'), t.get('route_name'), str(t.get('created_at',''))[:10])
        if key in seen:
            duplicates.append(t['track_uuid'])
        else:
            seen[key] = t['track_uuid']
    return duplicates

def build_route_averages(tracks):
    """Average GPS traces for each route name."""
    route_tracks = {}
    for t in tracks:
        name = t.get('route_name')
        if not name:
            continue
        gps = t.get('raw_payload', {})
        points = gps.get('gps_points', []) if isinstance(gps, dict) else []
        if points:
            if name not in route_tracks:
                route_tracks[name] = []
            route_tracks[name].append(points)
    
    averages = {}
    for name, traces in route_tracks.items():
        if len(traces) < 2:
            continue
        # Simple average: take median point count
        median_len = sorted(len(t) for t in traces)[len(traces)//2]
        avg_points = []
        for i in range(median_len):
            lats = []
            lngs = []
            for trace in traces:
                if i < len(trace):
                    lats.append(trace[i].get('lat', 0))
                    lngs.append(trace[i].get('lng', 0))
            if lats and lngs:
                avg_points.append({
                    'lat': sum(lats) / len(lats),
                    'lng': sum(lngs) / len(lngs)
                })
        averages[name] = avg_points
    
    return averages

def generate_stats(tracks):
    """Generate route statistics."""
    stats = {}
    for t in tracks:
        name = t.get('route_name')
        if not name:
            continue
        if name not in stats:
            stats[name] = {
                'count': 0,
                'times': [],
                'distances': [],
                'ratings': [],
            }
        stats[name]['count'] += 1
        if t.get('total_time_sec'):
            stats[name]['times'].append(t['total_time_sec'])
        if t.get('distance_m'):
            stats[name]['distances'].append(t['distance_m'])
        if t.get('rating'):
            stats[name]['ratings'].append(t['rating'])
    
    result = {}
    for name, s in stats.items():
        result[name] = {
            'track_count': s['count'],
            'avg_time_sec': sum(s['times'])/len(s['times']) if s['times'] else 0,
            'avg_distance_m': sum(s['distances'])/len(s['distances']) if s['distances'] else 0,
            'avg_rating': sum(s['ratings'])/len(s['ratings']) if s['ratings'] else 0,
        }
    return result

def main():
    print("=== PARA PH DATA PIPELINE ===")
    print(f"Started: {datetime.now().isoformat()}")
    print()
    
    # 1. Fetch all tracks
    print("1. Fetching commute tracks...")
    tracks = fetch_all('ph_user_tracks')
    print(f"   Total: {len(tracks)} tracks")
    
    # 2. Remove tracks without GPS
    with_gps = [t for t in tracks if t.get('gps_points', 0) > 0]
    print(f"   With GPS: {len(with_gps)}")
    
    # 3. Remove short tracks
    valid = [t for t in with_gps if t.get('distance_m', 0) >= 100]
    print(f"   Valid (>= 100m): {len(valid)}")
    
    # 4. Deduplicate
    dupes = deduplicate_tracks(valid)
    print(f"   Duplicates: {len(dupes)}")
    
    # 5. Route stats
    stats = generate_stats(valid)
    print(f"   Unique routes: {len(stats)}")
    
    print()
    print("=== ROUTE STATISTICS ===")
    for name, s in sorted(stats.items(), key=lambda x: x[1]['track_count'], reverse=True)[:10]:
        print(f"   {s['track_count']}x  {name}  ({s['avg_time_sec']/60:.1f} min avg)")
    
    print()
    print("=== CLEANING COMPLETE ===")
    print("Ready for analysis.")

if __name__ == "__main__":
    main()
