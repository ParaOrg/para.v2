/**
 * cityGazetteer.js — Per-city place name lookups for national coverage.
 * Local gazetteer that works offline, with fallback to backend/Nominatim.
 */

export const CITY_GAZETTEER = {
  "Metro Manila": {
    "upd": [14.6550, 121.0677],
    "ust": [14.6091, 120.9893],
    "sm north": [14.6560, 121.0315],
    "cubao": [14.6190, 121.0540],
    "makati": [14.5547, 121.0244],
    "bgc": [14.5487, 121.0468],
    "moa": [14.5350, 120.9821],
    "pitx": [14.5070, 120.9900],
    "edsa": [14.5430, 121.0170],
    "taft": [14.5375, 120.9835],
    "buendia": [14.5550, 121.0160],
  },
  "Cebu City": {
    "sm cebu": [10.3111, 123.9181],
    "colon": [10.2940, 123.8960],
    "it park": [10.3270, 123.9060],
    "mactan airport": [10.3070, 123.9790],
    "fuente": [10.3090, 123.8930],
    "banawa": [10.3010, 123.8830],
    "talamban": [10.3520, 123.9000],
    "mabolo": [10.3090, 123.9170],
    "lahug": [10.3230, 123.8890],
    "mandaue": [10.3240, 123.9430],
  },
  "Davao City": {
    "sm davao": [7.0820, 125.6140],
    "rojas": [7.0700, 125.6090],
    "toril": [7.0000, 125.4940],
    "matina": [7.0630, 125.5890],
    "bajada": [7.0950, 125.6360],
    "lanang": [7.1040, 125.6510],
    "e-colony": [7.0690, 125.6070],
    "agdao": [7.0860, 125.6260],
    "buhangin": [7.0920, 125.6520],
    "mintal": [7.0170, 125.4550],
  },
  "Iloilo City": {
    "sm city iloilo": [10.7140, 122.5480],
    "molo": [10.6960, 122.5330],
    "jaro": [10.7130, 122.5620],
    "la paz": [10.7060, 122.5670],
    "mandurriao": [10.7140, 122.5140],
    "lapaz": [10.7060, 122.5670],
    "diversion": [10.7200, 122.5430],
    "plaza": [10.6920, 122.5700],
    "ungka": [10.7460, 122.5120],
    "oñate": [10.6980, 122.5630],
  },
  "Baguio City": {
    "burnham": [16.4120, 120.5940],
    "session road": [16.4110, 120.5980],
    "sm baguio": [16.4170, 120.5920],
    "mines view": [16.4190, 120.6320],
    "la trinidad": [16.4550, 120.5880],
    "camp john hay": [16.4000, 120.6070],
  },
};

export function resolveLocalPlace(name, city) {
  const cityData = CITY_GAZETTEER[city];
  if (!cityData) return null;
  const key = name.toLowerCase().trim();
  for (const [alias, coords] of Object.entries(cityData)) {
    if (key === alias || key.includes(alias) || alias.includes(key)) {
      return { lat: coords[0], lng: coords[1], display_name: `${name}, ${city}`, source: "local_gazetteer" };
    }
  }
  return null;
}

export function getSupportedCities() {
  return Object.keys(CITY_GAZETTEER);
}
