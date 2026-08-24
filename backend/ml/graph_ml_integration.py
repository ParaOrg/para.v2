"""
graph_ml_integration.py — Integrates ML features into routing graph.
Uses route_ml_stats to adjust edge weights in the NetworkX graph.
"""

import os
import math
from typing import Dict, Optional
from supabase import create_client, Client

class MLGraphEnhancer:
    """Enhances routing graph with ML-derived edge weights."""
    
    def __init__(self):
        self.supabase: Optional[Client] = None
        url = os.environ.get("SUPABASE_URL", "https://tcvomrkytxnetzijwqad.supabase.co")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if key:
            self.supabase = create_client(url, key)
    
    def fetch_ml_stats(self) -> Dict[str, Dict]:
        """Fetch all route ML stats for graph enhancement."""
        if not self.supabase:
            return {}
        
        res = self.supabase.table("route_ml_stats").select("*").execute()
        stats = {}
        for row in res.data or []:
            if row.get("route_uuid"):
                stats[row["route_uuid"]] = row
        return stats
    
    def compute_edge_weight(self, base_weight: float, ml_stats: Optional[Dict]) -> float:
        """
        Compute enhanced edge weight using ML features.
        
        Weight = base_weight * (1 / reliability_score) * (1 + speed_penalty)
        
        - High reliability (close to 1.0) → weight close to base
        - Low reliability (close to 0.0) → weight increases (route less preferred)
        - High std_dev_speed → weight increases (unpredictable ETA)
        """
        if not ml_stats:
            return base_weight
        
        reliability = ml_stats.get("reliability_score", 0.5)
        std_dev_speed = ml_stats.get("std_dev_speed", 0)
        avg_speed = ml_stats.get("avg_speed_kmh", 0)
        
        # Reliability factor: 1/reliability (range 1.0 to ~5.0)
        reliability_factor = 1.0 / max(reliability, 0.2)
        
        # Speed variability factor: penalize unpredictable routes
        if avg_speed > 0:
            variability_factor = 1.0 + (std_dev_speed / avg_speed)
        else:
            variability_factor = 1.0
        
        # Combined weight
        enhanced_weight = base_weight * reliability_factor * variability_factor
        
        return enhanced_weight
    
    def get_reliability_score(self, route_uuid: str) -> float:
        """Get reliability score for a specific route."""
        if not self.supabase:
            return 0.5
        
        res = self.supabase.table("route_ml_stats") \
            .select("reliability_score") \
            .eq("route_uuid", route_uuid) \
            .limit(1) \
            .execute()
        
        if res.data:
            return res.data[0].get("reliability_score", 0.5)
        return 0.5
    
    def get_fare_estimate(self, route_name: str) -> Optional[Dict]:
        """Get fare estimate for a route."""
        if not self.supabase:
            return None
        
        res = self.supabase.table("route_ml_stats") \
            .select("avg_fare, min_fare, max_fare, fare_std_dev") \
            .eq("route_name", route_name) \
            .limit(1) \
            .execute()
        
        if res.data:
            return res.data[0]
        return None
