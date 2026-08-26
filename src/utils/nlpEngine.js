// Deterministic NLP Engine for Para PH - OPTIMAL DICTIONARY (325+ words)
// No LLM - pure regex, dictionaries, and fuzzy matching

// ── TAGLISH DICTIONARY ──────────────────────────────
export const TAGLISH = {
  // Mode avoidance (30 words)
  'ayoko': 'avoid', 'wag': 'avoid', 'huwag': 'avoid', 'no': 'avoid',
  'ayaw ko': 'avoid', 'iwasan': 'avoid', 'iwas': 'avoid',
  'ayoko ng': 'avoid', 'wag na': 'avoid', 'huwag na': 'avoid',
  'ayoko mag': 'avoid', 'ayaw': 'avoid', 'avoid': 'avoid',
  'iwasan mo': 'avoid', 'huwag mo': 'avoid', 'wag mo': 'avoid',
  'ayoko sana': 'avoid', 'sana hindi': 'avoid', 'hindi sana': 'avoid',
  'ayoko sana mag': 'avoid', 'wag sana': 'avoid',
  'ayoko ng mag': 'avoid', 'ayaw ko mag': 'avoid',
  'iwasan ang': 'avoid', 'huwag ang': 'avoid',
  'skip': 'avoid', 'pass sa': 'avoid', 'ayoko sa': 'avoid',
  'no sa': 'avoid', 'not': 'avoid',
  
  // Mode preference (15 words)
  'gusto ko': 'prefer', 'mas gusto': 'prefer', 'prefer': 'prefer',
  'gusto': 'prefer', 'mas ok': 'prefer', 'mas maganda': 'prefer',
  'mas mabuti': 'prefer', 'mas gusto ko': 'prefer',
  'sana': 'prefer', 'kung pwede': 'prefer',
  'mas okay': 'prefer', 'mas mainam': 'prefer',
  'prefer ko': 'prefer', 'gusto ko sana': 'prefer',
  'mas bet': 'prefer',
  
  // Cost preferences (25 words)
  'pinakamura': 'cheapest', 'mura': 'cheap', 'tipid': 'budget',
  'cheapest': 'cheapest', 'budget': 'budget', 'makatipid': 'budget',
  'makamura': 'cheap', 'pambudget': 'budget', 'affordable': 'budget',
  'mahal': 'expensive', 'okay lang mahal': 'fare_tolerance_high',
  'kahit mahal': 'fare_tolerance_high', 'basta mabilis': 'time_first',
  'hindi problema ang pera': 'fare_tolerance_high',
  'ok lang mahal': 'fare_tolerance_high',
  'no budget': 'fare_tolerance_high', 'walang budget': 'fare_tolerance_high',
  'kahit magkano': 'fare_tolerance_high', 'kahit mahal basta': 'time_first',
  'tipid mode': 'budget', 'nagtitipid': 'budget',
  'matipid': 'budget', 'mura lang': 'cheap',
  'pinaka mura': 'cheapest',
  
  // Time preferences (25 words)
  'pinakamabilis': 'fastest', 'mabilis': 'fast', 'fastest': 'fastest',
  'mabilis lang': 'fast', 'kahit matagal': 'time_tolerance_high',
  'matagal': 'slow_ok', 'hindi nagmamadali': 'time_tolerance_high',
  'di nagmamadali': 'time_tolerance_high', 'chill lang': 'time_tolerance_high',
  'relax lang': 'time_tolerance_high', 'hindi naman nagmamadali': 'time_tolerance_high',
  'mabilisan': 'fast', 'mabilis sana': 'fast',
  'pinaka mabilis': 'fastest', 'quick': 'fast',
  'mabilis lang sana': 'fast', 'hindi rush': 'time_tolerance_high',
  'di rush': 'time_tolerance_high', 'maraming oras': 'time_tolerance_high',
  'hindi naghahabol': 'time_tolerance_high', 'hindi hahabol': 'time_tolerance_high',
  'kahit gaano katagal': 'time_tolerance_high', 'kahit matagal basta': 'time_first',
  'basta mabilis': 'fastest',
  
  // Walking preferences (20 words)
  'konting lakad': 'min_walking', 'less walking': 'min_walking',
  'ayoko ng lakad': 'min_walking', 'ayoko maglakad': 'min_walking',
  'konti lang lakad': 'min_walking', 'walking': 'min_walking',
  'ayoko maglakad ng malayo': 'min_walking', 'ayoko ng mahabang lakad': 'min_walking',
  'konting lakad lang': 'min_walking', 'ayaw ko maglakad': 'min_walking',
  'ayaw maglakad': 'min_walking', 'ayoko lumakad': 'min_walking',
  'ayaw lumakad': 'min_walking', 'konti lakad': 'min_walking',
  'hindi malayo lakad': 'min_walking', 'ayoko ng lakaran': 'min_walking',
  'ok lang maglakad': 'walking_ok', 'ok maglakad': 'walking_ok',
  'maraming lakad': 'max_walking_ok', 'walkable': 'walking_ok',
  
  // Transfer preferences (20 words)
  'maraming sakay': 'min_transfers', 'ayoko ng palit': 'min_transfers',
  'ayoko maglipat': 'min_transfers', 'konting sakay': 'min_transfers',
  'lipat': 'transfer', 'palit': 'transfer', 'sakay': 'transfer',
  'direct': 'min_transfers', 'diretso': 'min_transfers',
  'ayoko ng palipat': 'min_transfers', 'ayaw maglipat': 'min_transfers',
  'konting lipat': 'min_transfers', 'ayoko magpalit': 'min_transfers',
  'isang sakay lang': 'min_transfers', 'diretso lang': 'min_transfers',
  'walang palit': 'min_transfers', 'walang lipat': 'min_transfers',
  'ayoko ng maraming sakay': 'min_transfers',
  'ayaw ng maraming sakay': 'min_transfers',
  'ayoko ng maraming lipat': 'min_transfers',
  
  // Comfort/hassle (20 words)
  'hassle': 'ask_clarification', 'hassle-free': 'min_hassle',
  'comfortable': 'prefer_comfort', 'komportable': 'prefer_comfort',
  'hindi hassle': 'min_hassle', 'madali': 'min_hassle',
  'walang hassle': 'min_hassle', 'hindi mahirap': 'min_hassle',
  'madaling sakyan': 'min_hassle', 'hindi nakakapagod': 'prefer_comfort',
  'nakakapagod': 'ask_clarification', 'nakakastress': 'ask_clarification',
  'hindi nakakastress': 'min_hassle', 'relax': 'prefer_comfort',
  'hindi siksikan': 'min_crowding', 'hindi puno': 'min_crowding',
  'maluwag': 'prefer_comfort', 'hindi siksik': 'min_crowding',
  'ayoko ng siksikan': 'min_crowding', 'ayaw ng masikip': 'min_crowding',
  
  // Weather (15 words)
  'uulan': 'weather_rain', 'umuulan': 'weather_rain',
  'baha': 'weather_flood', 'rush hour': 'time_peak',
  'maulan': 'weather_rain', 'ulan': 'weather_rain',
  'bagyo': 'weather_storm', 'bumabagyo': 'weather_storm',
  'flood': 'weather_flood', 'baha sa': 'weather_flood',
  'may bagyo': 'weather_storm', 'umuulan ng malakas': 'weather_rain',
  'ambon': 'weather_drizzle', 'mahangin': 'weather_windy',
  'maaraw': 'weather_clear',
  
  // Time urgency (15 words)
  'kailangan': 'deadline', 'need': 'deadline', 'dapat': 'deadline',
  'before': 'deadline', 'by': 'deadline', 'ng': 'deadline',
  'kailangan ko': 'deadline', 'kailangan nandun': 'deadline',
  'dapat nandun': 'deadline', 'hahabol': 'deadline',
  'naghahabol': 'deadline', 'kailangan makarating': 'deadline',
  'deadline': 'deadline', 'appointment': 'deadline',
  'meeting': 'deadline',
  
  // Route request (25 words)
  'paano': 'route_request', 'how': 'route_request',
  'pano': 'route_request', 'pupunta': 'route_request',
  'papunta': 'route_request', 'from': 'route_request',
  'galing': 'from', 'mula': 'from',
  'to': 'to', 'sa': 'to',
  'pumunta': 'route_request', 'magpunta': 'route_request',
  'puntang': 'to', 'papuntang': 'to',
  'galing sa': 'from', 'mula sa': 'from',
  'route': 'route_request', 'commute': 'route_request',
  'byahe': 'route_request', 'biyahe': 'route_request',
  'sakay papunta': 'route_request', 'sasakay': 'route_request',
  'pano pumunta': 'route_request', 'paano magpunta': 'route_request',
  'how to go': 'route_request', 'how to get': 'route_request',
  'directions': 'route_request',
  
  // Questions (20 words)
  'saan': 'where', 'bababa': 'where_alight', 'sakay': 'where_board',
  'anong': 'what', 'ilan': 'how_many', 'gaano': 'how_long',
  'saan ako bababa': 'where_alight', 'saan bababa': 'where_alight',
  'saan sasakay': 'where_board', 'saan ako sasakay': 'where_board',
  'magkano': 'how_much_fare', 'magkano pamasahe': 'how_much_fare',
  'gaano katagal': 'how_long', 'gaano kalayo': 'how_far',
  'ilang sakay': 'how_many_transfers', 'ilang lipat': 'how_many_transfers',
  'ano': 'what', 'alin': 'which', 'kelan': 'when',
  'anong oras': 'what_time',
  
  // Additional stop/place terms (15 words)
  'kanto': 'corner', 'palengke': 'market', 'simbahan': 'church',
  'ospital': 'hospital', 'paaralan': 'school', 'terminal': 'terminal',
  'babaan': 'alighting_point', 'sakayan': 'boarding_point',
  'mall': 'shopping', 'market': 'market',
  'station': 'station', 'tindahan': 'store',
  'munisipyo': 'city_hall', 'plaza': 'plaza',
  'park': 'park',
};

// ── TRANSPORT MODE ALIASES ──────────────────────────
export const MODE_ALIASES = {
  'jeep': 'jeepney', 'jeepney': 'jeepney', 'dyip': 'jeepney', 'dyipni': 'jeepney',
  'bus': 'bus', 'busina': 'bus',
  'mrt': 'mrt', 'train': 'mrt', 'rail': 'mrt', 'tren': 'mrt',
  'lrt': 'lrt', 'lrt1': 'lrt', 'lrt2': 'lrt',
  'uv': 'uv_express', 'van': 'uv_express', 'express': 'uv_express',
  'uv express': 'uv_express', 'fx': 'uv_express',
  'trike': 'trike', 'tricycle': 'trike', 'traysikel': 'trike', 'tricycle': 'trike',
  'angkas': 'angkas', 'motor': 'angkas', 'habal': 'angkas',
  'grab': 'grab', 'taxi': 'grab', 'uber': 'grab',
};

// ── NORMALIZATION ───────────────────────────────────
export function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── INTENT DETECTION ───────────────────────────────
export function detectIntent(text) {
  const normalized = normalize(text);
  const intents = [];
  
  // Route request
  if (/(paano|how|pano|pupunta|papunta|from.*to|route|commute|byahe|biyahe|sakay papunta|pano pumunta|how to go|directions)/.test(normalized)) {
    intents.push({ intent: 'ROUTE_REQUEST', confidence: 0.9 });
  }
  
  // Avoid mode
  const avoidMatch = normalized.match(/(ayoko|wag|huwag|avoid|no|iwas|iwasan|ayaw)[\s\S]*?(mrt|lrt|train|jeep|bus|uv|trike|angkas|grab|tren)/);
  if (avoidMatch) {
    intents.push({ intent: 'AVOID_MODE', mode: MODE_ALIASES[avoidMatch[2]] || avoidMatch[2], confidence: 0.85 });
  }
  
  // Prefer mode
  const preferMatch = normalized.match(/(gusto|prefer|mas gusto|mas ok|mas maganda)[\s\S]*?(mrt|lrt|train|jeep|bus|uv|trike|angkas|grab)/);
  if (preferMatch) {
    intents.push({ intent: 'PREFER_MODE', mode: MODE_ALIASES[preferMatch[2]] || preferMatch[2], confidence: 0.85 });
  }
  
  // Cost
  if (/(pinakamura|cheapest|mura|tipid|budget|makatipid|pambudget|affordable|nagtitipid|matipid)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_FARE', confidence: 0.9 });
  }
  if (/(mahal|expensive|fare_tolerance|hindi problema ang pera|walang budget|kahit magkano)/.test(normalized)) {
    intents.push({ intent: 'FARE_TOLERANT', confidence: 0.8 });
  }
  
  // Time
  if (/(pinakamabilis|fastest|mabilis|quick|mabilisan)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_TIME', confidence: 0.9 });
  }
  if (/(kahit matagal|matagal|hindi nagmamadali|chill lang|relax lang|maraming oras|hindi naghahabol)/.test(normalized)) {
    intents.push({ intent: 'TIME_TOLERANT', confidence: 0.8 });
  }
  
  // Walking
  if (/(konting lakad|less walking|ayoko.*lakad|konti.*lakad|ayaw.*lakad|konti lakad|hindi malayo lakad)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_WALKING', confidence: 0.9 });
  }
  
  // Transfers
  if (/(maraming sakay|ayoko.*palit|konting sakay|direct|diretso|ayaw.*lipat|konting lipat|isang sakay lang|walang palit|walang lipat)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_TRANSFERS', confidence: 0.85 });
  }
  
  // Weather
  if (/(uulan|umuulan|maulan|ulan|weather|bagyo|bumabagyo|ambon)/.test(normalized)) {
    intents.push({ intent: 'WEATHER_AWARE', confidence: 0.9 });
  }
  if (/(baha|flood|baha sa)/.test(normalized)) {
    intents.push({ intent: 'FLOOD_AWARE', confidence: 0.9 });
  }
  
  // Hassle
  if (/(hassle-free|hindi hassle|walang hassle|madali|madaling sakyan|hindi mahirap)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_HASSLE', confidence: 0.7 });
  }
  if (/(nakakapagod|nakakastress|hassle)/.test(normalized)) {
    intents.push({ intent: 'ASK_CLARIFICATION', confidence: 0.6 });
  }
  
  // Crowding
  if (/(hindi siksikan|hindi puno|maluwag|hindi siksik|ayoko ng siksikan|ayaw ng masikip)/.test(normalized)) {
    intents.push({ intent: 'MINIMIZE_CROWDING', confidence: 0.8 });
  }
  
  // Deadline
  const deadlineMatch = normalized.match(/(kailangan|dapat|need|before|by|deadline|appointment|meeting)[\s\S]*?(\d{1,2}(:\d{2})?)/);
  if (deadlineMatch) {
    intents.push({ intent: 'ARRIVAL_DEADLINE', time: deadlineMatch[2], confidence: 0.85 });
  }
  
  // Questions
  if (/(saan.*baba|babaan|where.*alight|saan.*bumaba)/.test(normalized)) {
    intents.push({ intent: 'WHERE_TO_ALIGHT', confidence: 0.9 });
  }
  if (/(ilang.*sakay|how many.*transfer|ilang.*lipat)/.test(normalized)) {
    intents.push({ intent: 'HOW_MANY_TRANSFERS', confidence: 0.85 });
  }
  if (/(magkano.*pamasahe|how much.*fare|magkano)/.test(normalized)) {
    intents.push({ intent: 'FARE_QUERY', confidence: 0.9 });
  }
  if (/(gaano.*katagal|how long|gaano katagal)/.test(normalized)) {
    intents.push({ intent: 'DURATION_QUERY', confidence: 0.85 });
  }
  
  return intents;
}

// ── PREFERENCE EXTRACTION ───────────────────────────
export function extractPreferences(text) {
  const normalized = normalize(text);
  const prefs = {
    avoid_modes: [],
    prefer_modes: [],
    max_walking: null,
    max_transfers: null,
    fare_tolerance: null,
    time_tolerance: null,
    weather_aware: false,
    min_hassle: false,
    min_crowding: false,
  };
  
  for (const [alias, mode] of Object.entries(MODE_ALIASES)) {
    if (new RegExp(`(ayoko|wag|huwag|avoid|no|iwas)[\\s\\S]*?${alias}`).test(normalized)) {
      if (!prefs.avoid_modes.includes(mode)) prefs.avoid_modes.push(mode);
    }
    if (new RegExp(`(gusto|prefer)[\\s\\S]*?${alias}`).test(normalized)) {
      if (!prefs.prefer_modes.includes(mode)) prefs.prefer_modes.push(mode);
    }
  }
  
  if (/(konting lakad|less walking|ayoko.*lakad|ayaw.*lakad)/.test(normalized)) {
    prefs.max_walking = 200;
  }
  
  if (/(maraming sakay|ayoko.*palit|direct|diretso|walang palit)/.test(normalized)) {
    prefs.max_transfers = 1;
  }
  
  if (/(pinakamura|cheapest|tipid|budget)/.test(normalized)) {
    prefs.fare_tolerance = 'low';
  } else if (/(mahal|expensive)/.test(normalized)) {
    prefs.fare_tolerance = 'high';
  }
  
  if (/(pinakamabilis|fastest|mabilis)/.test(normalized)) {
    prefs.time_tolerance = 'fast';
  } else if (/(kahit matagal|hindi nagmamadali)/.test(normalized)) {
    prefs.time_tolerance = 'relaxed';
  }
  
  if (/(uulan|umuulan|maulan|baha|flood|bagyo)/.test(normalized)) {
    prefs.weather_aware = true;
  }
  
  if (/(hassle-free|hindi hassle|madali)/.test(normalized)) {
    prefs.min_hassle = true;
  }
  
  if (/(hindi siksikan|hindi puno|maluwag|ayoko ng siksikan)/.test(normalized)) {
    prefs.min_crowding = true;
  }
  
  return prefs;
}

// ── CLARIFICATION GENERATION ────────────────────────
export function generateClarification(missingField) {
  const questions = {
    origin: { text: 'Saan ka galing?', chips: ['📍 Use my location', 'UP Diliman', 'Cubao', 'Makati'] },
    destination: { text: 'Saan ka papunta?', chips: ['BGC', 'Makati', 'SM MOA', 'Ortigas'] },
    preference: { text: 'Anong preference mo?', chips: ['💰 Pinakamura', '⚡ Pinakamabilis', '🚶 Konting lakad', '🔄 Konting sakay'] },
    hassle: { text: 'Anong hassle ang gusto mong iwasan?', chips: ['⏳ Long waiting', '🚶 Walking', '🔄 Transfers', '👥 Crowding', '💰 High fare'] },
  };
  return questions[missingField] || questions.destination;
}

// ── FUZZY LOCATION MATCHING ─────────────────────────
export function fuzzyMatchLocation(input, locationsList) {
  const normalized = normalize(input);
  let bestMatch = null;
  let bestScore = 0;
  
  for (const loc of locationsList) {
    const locNormalized = normalize(loc.name);
    const aliases = loc.aliases || [];
    
    if (locNormalized === normalized) return { location: loc, score: 1.0 };
    
    for (const alias of aliases) {
      if (normalize(alias) === normalized) return { location: loc, score: 0.98 };
      const normalizedAlias = normalize(alias);
      if (normalizedAlias && normalized.includes(normalizedAlias)) {
        return { location: loc, score: 0.95 };
      }
    }
    
    if (locNormalized.includes(normalized) || normalized.includes(locNormalized)) {
      const score = 0.8;
      if (score > bestScore) { bestScore = score; bestMatch = loc; }
    }
    
    const overlap = [...normalized].filter(c => locNormalized.includes(c)).length / Math.max(normalized.length, locNormalized.length);
    if (overlap > 0.6 && overlap > bestScore) { bestScore = overlap; bestMatch = loc; }
  }
  
  return bestMatch ? { location: bestMatch, score: bestScore } : null;
}

// ── RESPONSE TEMPLATES ──────────────────────────────
export function generateResponse(routeData, preferences) {
  if (!routeData) return '⚠️ Walang nakitang route. Try different locations.';
  const { segments, total_time_min, total_fare, transfers, biyahe_score } = routeData;
  let response = `Best route found! 🚐\n\n⏱ ETA: ${total_time_min} minutes\n💰 Fare: ₱${total_fare}\n🔄 Transfers: ${transfers}\n🟣 Biyahe Score: ${biyahe_score}/100\n\nSegments:\n`;
  segments.forEach((seg, i) => {
    const icon = seg.mode === 'walk' ? '🚶' : '🚐';
    response += `${i + 1}. ${icon} ${seg.route} (${seg.time_min} min)\n`;
  });
  return response;
}
