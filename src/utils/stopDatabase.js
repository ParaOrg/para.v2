/**
 * stopDatabase.js — Hardcoded transit stops for offline autofill.
 * Syncs with Supabase transit_stops table when online.
 */

const HARDCODED_STOPS = {
  train: {
    "LRT-1": ["Baclaran", "EDSA", "Libertad", "Gil Puyat", "Vito Cruz", "Quirino", "Pedro Gil", "UN Avenue", "Central Terminal", "Carriedo", "Doroteo Jose", "Bambang", "Tayuman", "Blumentritt", "Abad Santos", "R. Papa", "5th Avenue", "Monumento", "Balintawak", "Roosevelt"],
    "LRT-2": ["Recto", "Legarda", "Pureza", "V. Mapa", "J. Ruiz", "Gilmore", "Betty Go-Belmonte", "Araneta Center-Cubao", "Anonas", "Katipunan", "Santolan", "Marikina", "Antipolo"],
    "MRT-3": ["North Avenue", "Quezon Avenue", "GMA-Kamuning", "Araneta Center-Cubao", "Santolan-Annapolis", "Ortigas", "Shaw Boulevard", "Boni", "Guadalupe", "Buendia", "Ayala", "Magallanes", "Taft Avenue"],
  },
  bus: {
    "EDSA Carousel": ["Monumento", "Bagong Barrio", "Balintawak", "Kaingin Road", "North Avenue", "Quezon Avenue", "Nepa Q-Mart", "Main Avenue", "Santolan", "Ortigas", "Shaw Boulevard", "Boni", "Guadalupe", "Buendia", "Ayala", "Magallanes", "Taft Avenue", "Roxas Boulevard", "MOA", "PITX"],
  },
  uv_express: {
    "Common UV Routes": ["Cubao", "Buendia", "Ayala", "Makati", "Ortigas", "BGC", "Alabang", "Baclaran", "Pasay", "Fairview", "Lagro", "Novaliches", "Monumento", "Malabon", "Navotas", "Valenzuela"],
  },
  ferry: {
    "Pasig River Ferry": ["Pinagbuhatan", "San Joaquin", "Maybunga", "Kalawaan", "Guadalupe", "Valenzuela", "Hulo", "Lambingan", "Sta. Ana", "PUP", "Quinta", "Escolta", "Lawton", "Plaza Mexico"],
  }
};

export function getStopsForVehicle(vehicleType, routeName = "") {
  // Return stops instantly (no network wait)
  const vehicleData = HARDCODED_STOPS[vehicleType];
  if (!vehicleData) return [];
  
  if (routeName && vehicleData[routeName]) {
    return vehicleData[routeName];
  }
  
  // Flatten all stops for this vehicle type
  const all = [];
  Object.values(vehicleData).forEach(stops => {
    stops.forEach(s => { if (!all.includes(s)) all.push(s); });
  });
  return all;
}

export function filterStops(stops, query) {
  if (!query || query.length < 1) return stops.slice(0, 8);
  return stops.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
}
