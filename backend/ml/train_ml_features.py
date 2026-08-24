"""
train_ml_features.py — ML Pipeline for Para PH
Processes user tracks, fare reports, and POIs into route ML features.

Run this script periodically (cron/Edge Function) to:
1. Calculate ETA predictions per route
2. Compute reliability scores
3. Estimate fare ranges
4. Score POI popularity
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import numpy as np
from supabase import create_client, Client

# Supabase connection
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tcvomrkytxnetzijwqad.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

class MLPipeline:
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_SERVICE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    async def fetch_user_tracks(self, since_hours: int = 168) -> List[Dict]:
        """Fetch user tracks from the last N hours."""
        since = (datetime.now() - timedelta(hours=since_hours)).isoformat()
        res = self.supabase.table("ph_user_tracks") \
            .select("*") \
            .gte("created_at", since) \
            .not_.is_("gps_points", "null") \
            .execute()
        return res.data or []
    
    async def fetch_fare_reports(self, since_hours: int = 168) -> List[Dict]:
        """Fetch fare reports from the last N hours."""
        since = (datetime.now() - timedelta(hours=since_hours)).isoformat()
        res = self.supabase.table("fare_reports") \
            .select("*") \
            .gte("reported_at", since) \
            .execute()
        return res.data or []
    
    def compute_eta_features(self, tracks: List[Dict]) -> Dict[str, Dict]:
        """Calculate ETA features per route from user tracks."""
        route_features = {}
        
        for track in tracks:
            route_uuid = track.get("route_uuid")
            if not route_uuid:
                continue
            
            if route_uuid not in route_features:
                route_features[route_uuid] = {
                    "speeds_kmh": [],
                    "wait_times_min": [],
                    "total_time_sec": [],
                    "distances_m": [],
                }
            
            # Extract from raw_payload
            raw = track.get("raw_payload", {})
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except:
                    raw = {}
            
            # Speed = distance / time
            distance_m = raw.get("totalDistanceM", 0) or track.get("distance_m", 0)
            total_time_sec = raw.get("totalTimeSec", 0) or track.get("total_time_sec", 0)
            
            if distance_m > 0 and total_time_sec > 0:
                speed_kmh = (distance_m / 1000) / (total_time_sec / 3600)
                route_features[route_uuid]["speeds_kmh"].append(speed_kmh)
                route_features[route_uuid]["total_time_sec"].append(total_time_sec)
                route_features[route_uuid]["distances_m"].append(distance_m)
            
            # Extract wait times from segments
            segments = raw.get("segments", [])
            for seg in segments:
                if seg.get("type") == "waiting" and seg.get("durationSec"):
                    route_features[route_uuid]["wait_times_min"].append(seg["durationSec"] / 60)
        
        # Compute statistics
        stats = {}
        for route_uuid, features in route_features.items():
            speeds = features["speeds_kmh"]
            waits = features["wait_times_min"]
            
            if speeds:
                stats[route_uuid] = {
                    "avg_speed_kmh": float(np.mean(speeds)),
                    "std_dev_speed": float(np.std(speeds)) if len(speeds) > 1 else 0,
                    "avg_wait_time_min": float(np.mean(waits)) if waits else 0,
                    "reliability_score": float(1.0 / (1.0 + np.std(speeds) / max(np.mean(speeds), 1e-6))),
                    "total_trips": len(speeds),
                }
        
        return stats
    
    def compute_fare_features(self, fares: List[Dict]) -> Dict[str, Dict]:
        """Calculate fare features per route."""
        route_fares = {}
        
        for fare in fares:
            route_name = fare.get("route_name", "Unknown")
            if route_name not in route_fares:
                route_fares[route_name] = []
            route_fares[route_name].append(float(fare.get("fare_amount", 0)))
        
        stats = {}
        for route_name, amounts in route_fares.items():
            if amounts:
                stats[route_name] = {
                    "avg_fare": float(np.mean(amounts)),
                    "min_fare": float(np.min(amounts)),
                    "max_fare": float(np.max(amounts)),
                    "fare_std_dev": float(np.std(amounts)) if len(amounts) > 1 else 0,
                }
        
        return stats
    
    async def update_route_ml_stats(self, eta_stats: Dict, fare_stats: Dict):
        """Upsert ML features into route_ml_stats table."""
        for route_uuid, stats in eta_stats.items():
            # Get route name from ph_routes
            route_res = self.supabase.table("ph_routes") \
                .select("name") \
                .eq("route_uuid", route_uuid) \
                .limit(1) \
                .execute()
            
            route_name = route_res.data[0]["name"] if route_res.data else None
            
            # Check if exists
            existing = self.supabase.table("route_ml_stats") \
                .select("id") \
                .eq("route_uuid", route_uuid) \
                .limit(1) \
                .execute()
            
            payload = {
                "route_uuid": route_uuid,
                "route_name": route_name,
                "avg_speed_kmh": stats.get("avg_speed_kmh", 0),
                "std_dev_speed": stats.get("std_dev_speed", 0),
                "avg_wait_time_min": stats.get("avg_wait_time_min", 0),
                "reliability_score": stats.get("reliability_score", 0.5),
                "total_trips": stats.get("total_trips", 0),
                "last_trained_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }
            
            # Add fare features if available
            if route_name and route_name in fare_stats:
                fare = fare_stats[route_name]
                payload.update(fare)
            
            if existing.data:
                self.supabase.table("route_ml_stats") \
                    .update(payload) \
                    .eq("route_uuid", route_uuid) \
                    .execute()
            else:
                self.supabase.table("route_ml_stats") \
                    .insert(payload) \
                    .execute()
    
    async def run(self):
        """Run the full ML pipeline."""
        print("🚀 Starting ML Pipeline...")
        
        # Fetch data
        print("📊 Fetching user tracks...")
        tracks = await self.fetch_user_tracks()
        print(f"  Found {len(tracks)} tracks")
        
        print("📊 Fetching fare reports...")
        fares = await self.fetch_fare_reports()
        print(f"  Found {len(fares)} fares")
        
        # Compute features
        print("🧮 Computing ETA features...")
        eta_stats = self.compute_eta_features(tracks)
        print(f"  Computed stats for {len(eta_stats)} routes")
        
        print("🧮 Computing fare features...")
        fare_stats = self.compute_fare_features(fares)
        print(f"  Computed fares for {len(fare_stats)} routes")
        
        # Update database
        print("💾 Updating route_ml_stats...")
        await self.update_route_ml_stats(eta_stats, fare_stats)
        
        print("✅ ML Pipeline complete!")

async def main():
    pipeline = MLPipeline()
    await pipeline.run()

if __name__ == "__main__":
    asyncio.run(main())
