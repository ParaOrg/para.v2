import { 
  calculateBearing,
  calculateDistanceMeters,
  rankRoutesByTrajectory,
} from '../spatialCalculations';

// DLSU to UST
const DLSU = { lat: 14.5658, lng: 120.9943 }; // De La Salle University
const UST = { lat: 14.6099, lng: 120.9895 }; // University of Santo Tomas

console.log('\n=== DLSU → UST Route Test ===');
const bearing = calculateBearing(DLSU.lat, DLSU.lng, UST.lat, UST.lng);
const distance = calculateDistanceMeters(DLSU.lat, DLSU.lng, UST.lat, UST.lng);
console.log(`Bearing: ${bearing.toFixed(2)}° (should be ~352° north)`);
console.log(`Distance: ${(distance / 1000).toFixed(2)} km (should be ~4.9km)`);

// Mock routes near DLSU/UST corridor
const routes = [
  {
    route_uuid: 'taft-ave',
    name: 'Taft Avenue',
    origin: [120.9943, 14.5658] as [number, number],
    destination: [120.9895, 14.6099] as [number, number],
    pathCoordinates: [
      [14.5658, 120.9943],
      [14.5800, 120.9920],
      [14.5950, 120.9900],
      [14.6099, 120.9895],
    ] as [number, number][],
  },
  {
    route_uuid: 'quirino-ave',
    name: 'Quirino Avenue',
    origin: [120.9943, 14.5658] as [number, number],
    destination: [120.9800, 14.6000] as [number, number],
    pathCoordinates: [
      [14.5658, 120.9943],
      [14.5750, 120.9900],
      [14.5850, 120.9850],
      [14.6000, 120.9800],
    ] as [number, number][],
  },
  {
    route_uuid: 'espana',
    name: 'España Boulevard',
    origin: [120.9895, 14.6099] as [number, number],
    destination: [120.9943, 14.5658] as [number, number],
    pathCoordinates: [
      [14.6099, 120.9895],
      [14.5950, 120.9900],
      [14.5800, 120.9920],
      [14.5658, 120.9943],
    ] as [number, number][],
  },
];

const ranked = rankRoutesByTrajectory(DLSU, UST, routes, 3);
console.log(`\nRanked ${ranked.length} routes:`);
ranked.forEach((route, i) => {
  console.log(`  ${i + 1}. ${route.name} — Score: ${(route.score * 100).toFixed(1)}% | Bearing diff: ${route.bearingDiff.toFixed(1)}° | Distance: ${(route.distanceToUser / 1000).toFixed(2)}km`);
});

console.log('\n=== DLSU → UST TEST DONE ===');
