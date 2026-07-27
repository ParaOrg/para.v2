import { describe, expect, it } from 'vitest';
import { adaptChatResponse, toDisplayType } from './routeAdapter';

// Shape mirrors backend/models.py ChatResponse/RouteResponse/RouteStep exactly.
const sampleChatResponse = {
  reply_text: '📍 Start ➡️ End\n✅ 20 mins, ₱28.',
  route_data: {
    success: true,
    total_distance_m: 3500,
    total_duration_min: 20,
    total_fare: 28,
    path_nodes: ['a', 'b', 'c'],
    message: '20 mins, ₱28. Head Southbound on MRT-3 North Avenue - Taft Avenue.',
    steps: [
      {
        action: 'walk', vehicle_type: 'walk', route_name: 'WALK_TO_TRANSIT',
        from_node: 'start', to_node: 'end', distance_m: 200, duration_min: 3, fare: 0,
        geometry: [[121.032, 14.653], [121.0321, 14.6524]], direction: 'S',
      },
      {
        action: 'board', vehicle_type: 'mrt3', route_name: 'MRT-3 North Avenue - Taft Avenue',
        from_node: 'start', to_node: 'end', distance_m: 3300, duration_min: 17, fare: 28,
        geometry: [[121.0321, 14.6524], [121.0014, 14.5375]], direction: 'S',
      },
    ],
  },
  alternatives: [],
  origin: 'Start',
  destination: 'End',
};

describe('toDisplayType', () => {
  it('maps backend vehicle_type values to the UI display types', () => {
    expect(toDisplayType('jeep')).toBe('Jeepney');
    expect(toDisplayType('walk')).toBe('Walk');
    expect(toDisplayType('mrt3')).toBe('Train');
    expect(toDisplayType('lrt1')).toBe('Train');
    expect(toDisplayType('lrt2')).toBe('Train');
    expect(toDisplayType('bus_city')).toBe('Bus');
    expect(toDisplayType('bus_prov')).toBe('Bus');
    expect(toDisplayType('uv_express')).toBe('UV');
  });

  it('falls back to Transit for an unrecognized mode', () => {
    expect(toDisplayType('some_future_mode')).toBe('Transit');
  });
});

describe('adaptChatResponse', () => {
  it('returns empty collections when there is no route_data', () => {
    const result = adaptChatResponse({ reply_text: 'no route', route_data: null, alternatives: [] });
    expect(result).toEqual({ markers: [], lines: [], route_options: [] });
  });

  it('builds one route_option per primary route with the real backend fare/time', () => {
    const result = adaptChatResponse(sampleChatResponse);

    expect(result.route_options).toHaveLength(1);
    const [option] = result.route_options;
    expect(option.route_label).toBe('Best Route');
    expect(option.fare_min).toBe(28);
    expect(option.fare_max).toBe(28);
    expect(option.time_min).toBe(20);
    expect(option.transfers).toBe(0); // one non-walk step -> 0 transfers
    expect(option.safety_rating).toBeNull(); // no backend data -- must not be fabricated
  });

  it('converts each RouteStep into a line with the real per-step fare and mapped type', () => {
    const result = adaptChatResponse(sampleChatResponse);
    const lines = result.route_options[0].lines;

    expect(lines).toHaveLength(2);
    expect(lines[0].type).toBe('Walk');
    expect(lines[0].fare).toBe(0);
    expect(lines[1].type).toBe('Train');
    expect(lines[1].fare).toBe(28);
    expect(lines[1].direction).toBe('S');
  });

  it('converts [lng, lat] geometry into {latitude, longitude} points', () => {
    const result = adaptChatResponse(sampleChatResponse);
    const firstPoint = result.route_options[0].lines[0].points[0];
    expect(firstPoint).toEqual({ latitude: 14.653, longitude: 121.032 });
  });

  it('builds a Start marker, one marker per transfer, and an End_Destination marker', () => {
    const result = adaptChatResponse(sampleChatResponse);
    const types = result.markers.map((m) => m.type);
    expect(types[0]).toBe('User_Location');
    expect(types[types.length - 1]).toBe('End_Destination');
  });

  it('includes alternative routes as additional route_options', () => {
    const withAlt = {
      ...sampleChatResponse,
      alternatives: [sampleChatResponse.route_data],
    };
    const result = adaptChatResponse(withAlt);
    expect(result.route_options).toHaveLength(2);
    expect(result.route_options[1].route_label).toBe('Alternative Route');
  });
});
