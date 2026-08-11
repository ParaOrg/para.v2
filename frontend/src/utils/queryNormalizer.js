const ALIAS_MAP = {
  'upd': 'UP Diliman',
  'up diliman': 'UP Diliman',
  'ust': 'UST',
  'ateneo': 'Ateneo',
  'dlsu': 'DLSU',
  'sm north': 'SM North EDSA',
  'sm north edsa': 'SM North EDSA',
  'moa': 'SM Mall of Asia',
  'ikot': 'UP Ikot',
  'toki': 'UP Toki',
  'katip': 'Katipunan LRT',
  'katipunan': 'Katipunan LRT',
  'cubao': 'Cubao',
  'makati': 'Makati CBD',
  'bgc': 'BGC',
  'ortigas': 'Ortigas Center',
  'pitx': 'PITX',
  'monumento': 'Monumento',
  'taft': 'Taft Avenue',
  'edsa': 'EDSA',
  'alabang': 'Alabang',
  'baclaran': 'Baclaran',
  'divisoria': 'Divisoria',
  'fairview': 'Fairview',
};

const RELATIVE_ORIGIN_RE = /\b(here|dito|nandito|my location|current location|where i am|near me)\b/i;

export function normalizeQuery(text, location) {
  let normalized = text.trim();
  normalized = normalized.replace(RELATIVE_ORIGIN_RE, 'here');
  for (const [alias, expansion] of Object.entries(ALIAS_MAP)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'gi');
    normalized = normalized.replace(re, expansion);
  }
  return { normalized, usedLocation: RELATIVE_ORIGIN_RE.test(text) };
}
