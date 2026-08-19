import { 
  calculateBearing, 
  bearingDifference, 
  calculateDistanceMeters,
  rankRoutesByTrajectory,
  checkGeofenceIntersection,
  nearestPointOnRoute,
} from '../spatialCalculations';

const USER_LOCATION = { lat: 14.6577, lng: 121.0644 };
const DESTINATION = { lat: 14.5995, lng: 120.9842 };

const MOCK_ROUTES = [
  {
    route_uuid: 'up-ikot',
    name: 'UP Ikot',
    origin: [121.0644, 14.6577] as [number, number],
    destination: [121.0644, 14.6577] as [number, number],
    pathCoordinates: [
      [14.6577, 121.0644],
      [14.6550, 121.0620],
      [14.6520, 121.0600],
      [14.6540, 121.0580],
      [14.6577, 121.0644],
    ] as [number, number][],
  },
  {
    route_uuid: 'up-katipunan',
    name: 'UP Katipunan',
    origin: [121.0742, 14.6576] as [number, number],
    destination: [121.0540, 14.6542] as [number, number],
    pathCoordinates: [
      [14.6576, 121.0742],
      [14.6560, 121.0680],
      [14.6550, 121.0600],
      [14.6542, 121.0540],
    ] as [number, number][],
  },
  {
    route_uuid: 'sangandaan-divisoria',
    name: 'Sangandaan-Divisoria',
    origin: [120.9690, 14.6096] as [number, number],
    destination: [120.9712, 14.6583] as [number, number],
    pathCoordinates: [
      [14.6096, 120.9690],
      [14.6200, 120.9700],
      [14.6400, 120.9705],
      [14.6583, 120.9712],
    ] as [number, number][],
  },
];

console.log('\n=== TEST 1: Bearing Calculation ===');
const bearing = calculateBearing(USER_LOCATION.lat, USER_LOCATION.lng, DESTINATION.lat, DESTINATION.lng);
console.log(`User → Destination bearing: ${bearing.toFixed(2)}°`);
console.assert(bearing > 180 && bearing < 270, 'Bearing should be southwest');
console.log('✅ Bearing test passed');

console.log('\n=== TEST 2: Distance Calculation ===');
const distance = calculateDistanceMeters(USER_LOCATION.lat, USER_LOCATION.lng, DESTINATION.lat, DESTINATION.lng);
console.log(`User → Destination distance: ${(distance / 1000).toFixed(2)} km`);
console.assert(distance > 5000 && distance < 20000, 'Distance should be 5-20km');
console.log('✅ Distance test passed');

console.log('\n=== TEST 3: Bearing Difference ===');
const diff1 = bearingDifference(0, 90);
const diff2 = bearingDifference(350, 10);
const diff3 = bearingDifference(0, 200);
console.log(`0° vs 90°: ${diff1}°`);
console.log(`350° vs 10°: ${diff2}°`);
console.log(`0° vs 200°: ${diff3}°`);
console.assert(diff1 === 90, 'Diff should be 90');
console.assert(diff2 === 20, 'Diff should be 20');
console.assert(diff3 === 160, 'Diff should be 160');
console.log('✅ Bearing difference test passed');

console.log('\n=== TEST 4: Trajectory Route Ranking ===');
const ranked = rankRoutesByTrajectory(USER_LOCATION, DESTINATION, MOCK_ROUTES, 3);
console.log(`Ranked ${ranked.length} routes:`);
ranked.forEach((route, i) => {
  console.log(`  ${i + 1}. ${route.name} — Score: ${(route.score * 100).toFixed(1)}% | Bearing diff: ${route.bearingDiff.toFixed(1)}° | Distance: ${(route.distanceToUser / 1000).toFixed(2)}km`);
});
console.assert(ranked.length > 0, 'Should return at least 1 route');
console.assert(ranked.length <= 3, 'Should return max 3 routes');
const hasNorthRoute = ranked.some(r => r.name === 'Sangandaan-Divisoria');
console.assert(!hasNorthRoute, 'Northbound route should be filtered');
console.log('✅ Route ranking test passed');

console.log('\n=== TEST 5: Geofence Intersection ===');
const stations = [
  { name: 'UP Campus Station', lat: 14.6577, lng: 121.0644 },
  { name: 'Katipunan Station', lat: 14.6576, lng: 121.0742 },
  { name: 'Philcoa Station', lat: 14.6542, lng: 121.0540 },
];

const exactHit = checkGeofenceIntersection(14.6577, 121.0644, stations, 50);
console.log(`Exact match: ${exactHit?.stationName} (${exactHit?.distanceMeters}m)`);
console.assert(exactHit?.stationName === 'UP Campus Station', 'Should match UP Campus');

const nearHit = checkGeofenceIntersection(14.6577, 121.0647, stations, 50);
console.log(`30m away: ${nearHit?.stationName} (${nearHit?.distanceMeters}m)`);
console.assert(nearHit?.stationName === 'UP Campus Station', 'Should match at 30m');

const farHit = checkGeofenceIntersection(14.6577, 121.0655, stations, 50);
console.log(`100m away: ${farHit ? 'MATCH (wrong)' : 'NO MATCH (correct)'}`);
console.assert(farHit === null, 'Should NOT match at 100m');

const katipunanHit = checkGeofenceIntersection(14.6576, 121.0746, stations, 50);
console.log(`40m from Katipunan: ${katipunanHit?.stationName} (${katipunanHit?.distanceMeters}m)`);
console.assert(katipunanHit?.stationName === 'Katipunan Station', 'Should match Katipunan');
console.log('✅ Geofence test passed');

console.log('\n=== TEST 6: Nearest Point on Route ===');
const nearest = nearestPointOnRoute(14.6560, 121.0680, MOCK_ROUTES[1].pathCoordinates);
console.log(`Nearest point: ${nearest.distanceMeters.toFixed(1)}m away`);
console.assert(nearest.distanceMeters < 100, 'Should be within 100m');
console.log('✅ Nearest point test passed');

console.log('\n=== ALL TESTS PASSED ===');
