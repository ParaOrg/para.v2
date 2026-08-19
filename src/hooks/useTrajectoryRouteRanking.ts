import { useState, useEffect } from 'react';
import { rankRoutesByTrajectory, RankedRoute, RouteCandidate } from '../utils/spatialCalculations';

interface UseTrajectoryRouteRankingProps {
  userLocation: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  routes: RouteCandidate[];
  maxResults?: number;
}

export function useTrajectoryRouteRanking({
  userLocation,
  destination,
  routes,
  maxResults = 3,
}: UseTrajectoryRouteRankingProps) {
  const [rankedRoutes, setRankedRoutes] = useState<RankedRoute[]>([]);
  const [isRanking, setIsRanking] = useState(false);

  useEffect(() => {
    if (!userLocation || !destination || routes.length === 0) {
      setRankedRoutes([]);
      return;
    }

    setIsRanking(true);
    
    // Deterministic calculation — no async needed
    const results = rankRoutesByTrajectory(
      userLocation,
      destination,
      routes,
      maxResults
    );
    
    setRankedRoutes(results);
    setIsRanking(false);
  }, [userLocation, destination, routes, maxResults]);

  return { rankedRoutes, isRanking };
}
