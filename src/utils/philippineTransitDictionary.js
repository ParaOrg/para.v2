// Comprehensive Philippine Transit Dictionary

export const TIME_EXPRESSIONS = {
  'madaling araw': { type: 'time_of_day', value: 'early_morning', hours: [4, 6] },
  'umaga': { type: 'time_of_day', value: 'morning', hours: [6, 10] },
  'tanghali': { type: 'time_of_day', value: 'noon', hours: [11, 13] },
  'hapon': { type: 'time_of_day', value: 'afternoon', hours: [14, 17] },
  'gabi': { type: 'time_of_day', value: 'evening', hours: [18, 21] },
  'rush hour': { type: 'peak', value: 'rush_hour' },
  'peak hours': { type: 'peak', value: 'rush_hour' },
};

export const STOP_TYPES = {
  'kanto': 'corner',
  'palengke': 'market',
  'simbahan': 'church',
  'ospital': 'hospital',
  'paaralan': 'school',
  'terminal': 'terminal',
  'babaan': 'alighting_point',
  'sakayan': 'boarding_point',
};

export const LANDMARK_TYPES = {
  'mall': 'shopping',
  'sm': 'shopping',
  'robinsons': 'shopping',
  'ayala': 'shopping',
  'palengke': 'market',
  'market': 'market',
  'simbahan': 'church',
  'church': 'church',
  'ospital': 'hospital',
  'hospital': 'hospital',
  'school': 'school',
  'university': 'school',
  'college': 'school',
  'terminal': 'transport_hub',
  'station': 'station',
};

export const COMMON_MISSPELLINGS = {
  'deliman': 'Diliman',
  'dilman': 'Diliman',
  'kobaw': 'Cubao',
  'cubao': 'Cubao',
  'makati': 'Makati',
  'ortigas': 'Ortigas',
  'espanya': 'España',
  'españa': 'España',
  'monumento': 'Monumento',
  'baclaran': 'Baclaran',
  'divisoria': 'Divisoria',
  'quiapo': 'Quiapo',
};

export const FARE_PATTERNS = {
  'mga': 'approx',
  'less than': 'max',
  'more than': 'min',
  'around': 'approx',
  'mga': 'approx',
};

export const INTENT_PATTERNS_EXTENDED = {
  WHERE_TO_ALIGHT: /(saan.*baba|babaan|where.*alight|saan.*bumaba)/,
  HOW_MANY_TRANSFERS: /(ilang.*sakay|how many.*transfer|ilang.*lipat)/,
  FARE_QUERY: /(magkano.*pamasahe|how much.*fare|magkano)/,
  DURATION_QUERY: /(gaano.*katagal|how long|gaano katagal)/,
  TRAFFIC_QUERY: /(traffic ba|matrapik|ma traffic)/,
  SERVICE_AVAILABILITY: /(may.*byahe|byahe pa|may biyahe)/,
  LAST_TRIP: /(last trip|huling byahe|last byahe)/,
  FIRST_TRIP: /(first trip|unang byahe|first byahe)/,
  COMPARE_ROUTES: /(ano.*mabilis|alin.*mabilis|compare)/,
};
