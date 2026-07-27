/**
 * Adapts the backend's ChatResponse/RouteResponse shape (see backend/models.py)
 * into the {markers, lines, route_options} shape the map/route UI components
 * (RouteLines, RouteMarkers, RouteOptionsPanel, RouteSteps) already expect.
 *
 * This exists because the UI components were built against a richer shape
 * than the backend actually returns; rather than rewriting every component,
 * this is the single translation point between the real API contract and
 * the UI's existing data model.
 */
import { LINE_COLORS } from "../components/map_constants";

const MODE_TO_DISPLAY_TYPE = {
  jeep: "Jeepney",
  walk: "Walk",
  uv_express: "UV",
  bus_city: "Bus",
  bus_prov: "Bus",
  lrt1: "Train",
  lrt2: "Train",
  mrt3: "Train",
};

export function toDisplayType(vehicleType) {
  return MODE_TO_DISPLAY_TYPE[vehicleType] || "Transit";
}

function stepToLine(step) {
  const type = toDisplayType(step.vehicle_type);
  return {
    type,
    name: step.route_name,
    color: LINE_COLORS[type] || LINE_COLORS.Default,
    points: step.geometry.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    fare: step.fare,
    direction: step.direction,
  };
}

function routeResponseToMarkers(routeResponse) {
  const steps = routeResponse?.steps || [];
  if (steps.length === 0) return [];

  const markers = [];
  const [firstLng, firstLat] = steps[0].geometry[0];
  markers.push({ latitude: firstLat, longitude: firstLng, type: "User_Location", name: "Start" });

  steps.slice(1).forEach((step) => {
    const [lng, lat] = step.geometry[0];
    markers.push({ latitude: lat, longitude: lng, type: toDisplayType(step.vehicle_type), name: step.route_name });
  });

  const lastStep = steps[steps.length - 1];
  const [lastLng, lastLat] = lastStep.geometry[lastStep.geometry.length - 1];
  markers.push({ latitude: lastLat, longitude: lastLng, type: "End_Destination", name: "Destination" });

  return markers;
}

function routeResponseToOption(routeResponse, routeId, label) {
  if (!routeResponse || !routeResponse.steps) return null;

  const transitSteps = routeResponse.steps.filter((s) => s.vehicle_type !== "walk");
  const fare = Math.round(routeResponse.total_fare);
  const time = Math.round(routeResponse.total_duration_min);

  return {
    route_id: routeId,
    route_label: label,
    time_min: time,
    time_max: time,
    fare_min: fare,
    fare_max: fare,
    transfers: Math.max(0, transitSteps.length - 1),
    // No backend safety-scoring exists yet -- left null rather than a
    // fabricated number; RouteOptionsPanel hides the row when this is null.
    safety_rating: null,
    markers: routeResponseToMarkers(routeResponse),
    lines: routeResponse.steps.map(stepToLine),
  };
}

/**
 * @param {object} chatResponse - the backend's ChatResponse (POST /chat body)
 * @returns {{markers: object[], lines: object[], route_options: object[]}}
 */
export function adaptChatResponse(chatResponse) {
  const routeData = chatResponse?.route_data;
  const alternatives = chatResponse?.alternatives || [];

  if (!routeData) {
    return { markers: [], lines: [], route_options: [] };
  }

  const routeOptions = [routeResponseToOption(routeData, "primary", "Best Route")].filter(Boolean);
  alternatives.forEach((alt, i) => {
    const opt = routeResponseToOption(alt, `alt_${i}`, "Alternative Route");
    if (opt) routeOptions.push(opt);
  });

  return {
    markers: routeOptions[0]?.markers || [],
    lines: routeOptions[0]?.lines || [],
    route_options: routeOptions,
  };
}
