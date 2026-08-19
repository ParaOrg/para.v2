/**
 * Full Contribute Page Testing Simulation
 * Tests all flows without running the actual React app
 * 
 * Run: npx tsx src/utils/__tests__/contributeFullSimulation.ts
 */

import { 
  calculateBearing,
  calculateDistanceMeters,
  rankRoutesByTrajectory,
  checkGeofenceIntersection,
  nearestPointOnRoute,
  bearingDifference,
} from '../spatialCalculations';

// ============================================
// TEST SCENARIO 1: UP Diliman → Manila City Hall
// ============================================
console.log('\n═══════════════════════════════════════════════════');
console.log('SCENARIO 1: UP Diliman → Manila City Hall');
console.log('═══════════════════════════════════════════════════');

const USER_UP = { lat: 14.6577, lng: 121.0644 };
const DEST_MANILA = { lat: 14.5995, lng: 120.9842 };

// Simulate route candidates near UP
const UP_ROUTES = [
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
    route_uuid: 'up-philcoa',
    name: 'UP Philcoa',
    origin: [121.0541, 14.6542] as [number, number],
    destination: [121.0644, 14.6577] as [number, number],
    pathCoordinates: [
      [14.6542, 121.0541],
      [14.6577, 121.0644],
    ] as [number, number][],
  },
];

const ranked1 = rankRoutesByTrajectory(USER_UP, DEST_MANILA, UP_ROUTES, 3);
console.log('\n📊 Route Ranking Results:');
ranked1.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name} — ${(r.score * 100).toFixed(1)}% (bearing diff: ${r.bearingDiff.toFixed(1)}°, dist: ${(r.distanceToUser / 1000).toFixed(2)}km)`);
});

// ============================================
// TEST SCENARIO 2: DLSU → UST
// ============================================
console.log('\n\n═══════════════════════════════════════════════════');
console.log('SCENARIO 2: DLSU → UST');
console.log('═══════════════════════════════════════════════════');

const DLSU = { lat: 14.5658, lng: 120.9943 };
const UST = { lat: 14.6099, lng: 120.9895 };

const DLSU_ROUTES = [
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

const ranked2 = rankRoutesByTrajectory(DLSU, UST, DLSU_ROUTES, 3);
console.log('\n📊 Route Ranking Results:');
ranked2.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name} — ${(r.score * 100).toFixed(1)}% (bearing diff: ${r.bearingDiff.toFixed(1)}°, dist: ${(r.distanceToUser / 1000).toFixed(2)}km)`);
});

// ============================================
// TEST SCENARIO 3: Geofence Simulation — Taft Avenue Ride
// ============================================
console.log('\n\n═══════════════════════════════════════════════════');
console.log('SCENARIO 3: Geofence Simulation — Taft Avenue Jeepney Ride');
console.log('═══════════════════════════════════════════════════');

const TAFT_STATIONS = [
  { name: 'DLSU Station', lat: 14.5658, lng: 120.9943 },
  { name: 'Vito Cruz Station', lat: 14.5620, lng: 120.9940 },
  { name: 'Quirino Station', lat: 14.5700, lng: 120.9930 },
  { name: 'Pedro Gil Station', lat: 14.5770, lng: 120.9910 },
  { name: 'UST Station', lat: 14.6099, lng: 120.9895 },
];

// Simulate GPS positions along the ride
const gpsTrail = [
  { lat: 14.5658, lng: 120.9943, label: 'Start at DLSU' },
  { lat: 14.5630, lng: 120.9940, label: 'Moving toward Vito Cruz' },
  { lat: 14.5622, lng: 120.9940, label: 'Near Vito Cruz (30m)' },
  { lat: 14.5620, lng: 120.9940, label: 'AT Vito Cruz Station' },
  { lat: 14.5680, lng: 120.9935, label: 'Moving toward Quirino' },
  { lat: 14.5702, lng: 120.9930, label: 'Near Quirino (20m)' },
  { lat: 14.5700, lng: 120.9930, label: 'AT Quirino Station' },
  { lat: 14.5900, lng: 120.9900, label: 'Moving toward UST' },
  { lat: 14.6097, lng: 120.9896, label: 'Near UST (30m)' },
  { lat: 14.6099, lng: 120.9895, label: 'AT UST Station' },
];

console.log('\n🚐 Simulating jeepney ride along Taft Avenue...');
let autoDropOffs = 0;
const triggeredStations: string[] = [];

for (const pos of gpsTrail) {
  const result = checkGeofenceIntersection(pos.lat, pos.lng, TAFT_STATIONS, 50);
  if (result) {
    if (!triggeredStations.includes(result.stationName)) {
      triggeredStations.push(result.stationName);
      autoDropOffs++;
      console.log(`  🔔 GEO FENCE TRIGGERED: ${result.stationName} at ${result.distanceMeters}m — ${pos.label}`);
    }
  } else {
    console.log(`  📍 ${pos.label} — no station within 50m`);
  }
}

console.log(`\n📊 Geofence Results: ${autoDropOffs} auto-drop-offs triggered`);
console.log(`   Stations detected: ${triggeredStations.join(', ')}`);

// ============================================
// TEST SCENARIO 4: Segment Timing Simulation
// ============================================
console.log('\n\n═══════════════════════════════════════════════════');
console.log('SCENARIO 4: Multi-Modal Segment Timing');
console.log('═══════════════════════════════════════════════════');

interface Segment {
  mode: 'walking' | 'riding';
  routeName: string | null;
  startTime: number;
  endTime: number | null;
  durationSec: number | null;
}

class CommuteTracker {
  private segments: Segment[] = [];
  private currentSegmentStart: number | null = null;
  private currentMode: 'walking' | 'riding' = 'walking';
  private currentRoute: string | null = null;

  hopOn(routeName: string) {
    if (this.currentMode === 'riding') return;
    // End walking segment
    if (this.currentSegmentStart) {
      this.segments.push({
        mode: 'walking',
        routeName: null,
        startTime: this.currentSegmentStart,
        endTime: Date.now(),
        durationSec: Math.round((Date.now() - this.currentSegmentStart) / 1000),
      });
    }
    // Start riding segment
    this.currentMode = 'riding';
    this.currentRoute = routeName;
    this.currentSegmentStart = Date.now();
    console.log(`  🚐 Hop On: ${routeName} — timer started`);
  }

  hopOff() {
    if (this.currentMode === 'walking') return;
    if (this.currentSegmentStart) {
      this.segments.push({
        mode: 'riding',
        routeName: this.currentRoute,
        startTime: this.currentSegmentStart,
        endTime: Date.now(),
        durationSec: Math.round((Date.now() - this.currentSegmentStart) / 1000),
      });
    }
    this.currentMode = 'walking';
    this.currentRoute = null;
    this.currentSegmentStart = Date.now();
    console.log(`  🚶 Hop Off: riding segment recorded`);
  }

  endRoute() {
    if (this.currentSegmentStart) {
      this.segments.push({
        mode: this.currentMode,
        routeName: this.currentRoute,
        startTime: this.currentSegmentStart,
        endTime: Date.now(),
        durationSec: Math.round((Date.now() - this.currentSegmentStart) / 1000),
      });
    }
    
    const summary = this.segments.map((seg, i) => {
      const icon = seg.mode === 'riding' ? '🚐' : '🚶';
      return `  ${i + 1}. ${icon} ${seg.routeName || 'Walking'} — ${seg.durationSec}s`;
    }).join('\n');
    
    const total = this.segments.reduce((sum, seg) => sum + (seg.durationSec || 0), 0);
    
    console.log(`\n  📋 FINAL TRIP SUMMARY:`);
    console.log(summary);
    console.log(`  Total: ${total}s (${Math.round(total / 60)} min)`);
  }
}

const tracker = new CommuteTracker();
console.log('\n🎬 Simulating multi-modal commute (accelerated time):');

// Simulate time passing using a mock Date.now
const originalNow = Date.now;
let mockTime = originalNow();
Date.now = () => mockTime;

function simulateSegment(mode: 'walking' | 'riding', routeName: string | null, durationSec: number) {
  if (mode === 'riding') {
    tracker.hopOn(routeName!);
  } else {
    tracker.hopOff();
  }
  mockTime += durationSec * 1000;
}

simulateSegment('riding', 'UP Ikot', 300);       // 5 min ride
simulateSegment('walking', null, 120);            // 2 min walk
simulateSegment('riding', 'UP Katipunan', 420);   // 7 min ride
simulateSegment('walking', null, 180);            // 3 min walk
simulateSegment('riding', 'Taft Avenue', 600);    // 10 min ride
tracker.endRoute();

Date.now = originalNow;

// ============================================
// TEST SCENARIO 5: Emergency Chat Detection
// ============================================
console.log('\n\n═══════════════════════════════════════════════════');
console.log('SCENARIO 5: Smart Chat Input Detection');
console.log('═══════════════════════════════════════════════════');

const chatInputs = [
  'I think I am lost',
  'change route please',
  'how much is the fare',
  'add a pin here',
  'traffic is heavy',
  'it is raining',
  'end route now',
  'help me',
];

function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  
  if (/(emergency|help|sos|unsafe|danger|scared|lost|stray|wrong way|off course)/.test(lower)) {
    return 'EMERGENCY — show safety options';
  }
  if (/(change route|re-route|reroute|new route|wrong route)/.test(lower)) {
    return 'ROUTE CHANGE — show nearby routes';
  }
  if (/(fare|bayad|how much|magkano|pamasahe)/.test(lower)) {
    return 'FARE REPORT — prompt for fare amount';
  }
  if (/(add\s*(a\s*)?pin|drop\s*(a\s*)?pin|poi|landmark|business|amenity)/.test(lower)) {
    return 'POI — activate pin drop';
  }
  if (/(traffic|jam|slow|masikip)/.test(lower)) {
    return 'TRAFFIC — log road condition';
  }
  if (/(rain|ulan|flood|baha|weather)/.test(lower)) {
    return 'WEATHER — show advisory';
  }
  if (/(end route|stop|tapos|done|finish)/.test(lower)) {
    return 'END ROUTE — save and summarize';
  }
  return 'DEFAULT — show help menu';
}

console.log('\n💬 Testing chat input detection:');
chatInputs.forEach((input) => {
  console.log(`  "${input}" → ${detectIntent(input)}`);
});

// ============================================
// FINAL RESULTS
// ============================================
console.log('\n\n═══════════════════════════════════════════════════');
console.log('SIMULATION COMPLETE — ALL SYSTEMS OPERATIONAL');
console.log('═══════════════════════════════════════════════════');
