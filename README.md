# 🚙 Para PH (v3.0)

**Para PH** is a hyper-scale geo-sentiment analyzer and multi-modal transit routing engine built specifically for Metro Manila and the Philippines. It combines natural language processing (for local slang normalization) with a highly optimized, crowdsourced spatial routing graph to provide accurate, multi-modal commute directions.

**Tagline:** *Bawat Byahe, Tulong sa Komunidad* — Every journey helps the community.

## ✨ Key Features

* **Multi-Modal Routing:** Seamlessly computes paths across Jeepneys, Buses, LRT/MRT, UV Express, and walking routes.
* **Smart Slang Normalization:** Built-in Gazetteer understands colloquial Philippine locations (e.g., "Katips" → "Katipunan", "UPD" → "UP Diliman").
* **Active Commute Tracking:** Step-by-step live guidance, hop-on/hop-off state tracking, and automatic commute logging.
* **Crowdsourced Route Mapping:** Guided multi-modal journey recorder (walk → jeep → transfer → destination), live GPS tracks, and GeoJSON export.
* **Community Contributions:** Route edits with voting, POI submissions, forum discussions.
* **Hyper-Fast Caching:** Multi-tiered resolution chain (Gazetteer L1 -> SQLite POI DB L2 -> Redis L3) achieving **0ms latency** for known POIs and completely bypassing 3rd-party API rate limits.
* **Weather Integration:** Live Open-Meteo weather with dynamic hero effects (sun/cloud/rain/thunder/snow/fog).
* **Role-Based Access:** Founder, Admin, and Commuter roles with tiered badges.

---

## 🏗️ System Architecture

Para PH operates on a decoupled, strictly separated 3-pillar architecture to ensure massive scalability and reliability.

### Pillar 1: AI / NLP Layer (`llm_engine.py`)
Acts purely as a Semantic Interpreter and Named Entity Recognizer (NER). 
* Parses user intents and extracts locations.
* Normalizes local slang via a pre-loaded Gazetteer (78+ terms).
* **Constraint:** Never attempts to output spatial coordinates directly to prevent hallucination.

### Pillar 2: Spatial Resolution & Tiered Caching
Converts normalized location strings into exact `(Lat, Lng)` coordinates using a deterministic fallback chain:
1. **Gazetteer L1:** In-memory exact match (0ms).
2. **POI DB L2 (`para_poi.db`):** Pre-populated and auto-cached SQLite lookup (0ms).
3. **Redis L2 Cache:** Fast distributed cache.
4. **Nominatim API L3:** External geocoding fallback (rate-limited to 1 req/sec).

### Pillar 3: Graph Routing Engine (`graph_engine.py`)
A custom NetworkX `MultiDiGraph` engine enforcing real-world transit rules.
* **Scale:** 10,300+ nodes, 12,500+ edges, 50+ unique transit routes.
* **Directionality Rules:** Jeepneys are strictly one-way loops (with reverse penalties), Buses/Trains are bidirectional.
* **Spatial Transfers:** Builds walking transfer edges between disconnected transit lines via spatial indexing (KDTree/R-Tree) within a 500m radius.
* **Virtual Node Injection:** Snaps origin/destination queries to the graph safely with graduated walking penalties.

---

## 📊 Data Tracking & Privacy

Para PH is transparent about what we collect and why. Full details in our [Privacy Policy](https://para-commute.org/privacy-policy).

### What We Track (and Why)

| Data Point | Purpose | Stored |
|-----------|---------|--------|
| **Email** | Account identity | Supabase `waitlist` |
| **Name** | Personalization | Supabase `waitlist` |
| **GPS trace** (during tracked commute only) | Build route geometry for unmapped routes | Supabase `ph_user_tracks.raw_payload` |
| **Wait time** | Stop reliability scoring | Supabase `ph_user_tracks` |
| **Segment times** | ETA prediction | Supabase `ph_user_tracks` |
| **Fare confirmation** | Validate route fares | Supabase `ph_user_tracks.comment` |
| **Traffic level** | Congestion modeling | Supabase `ph_user_tracks.comment` |
| **Route accuracy** | Quality scoring | Supabase `ph_user_tracks.comment` |
| **Route edits + votes** | Crowdsourced route improvement | Supabase `route_edits` |
| **POI pins** | Place database | Supabase `ph_places` |

### What We DON'T Track

- ❌ Location before explicit consent
- ❌ Background GPS (only during active tracking)
- ❌ Raw email in commute logs (identity via token)
- ❌ PII beyond what's listed above
- ❌ Location data sold to third parties

### Data Cleaning Pipeline

`data_pipeline.py` runs on demand to:
- Remove GPS outliers (>500m jumps, >50m accuracy)
- Remove short tracks (<100m)
- Deduplicate tracks (same user/route/day)
- Average multiple traces for clean route geometry
- Generate route statistics for analysis

---

## 🛠️ Tech Stack

* **Backend:** Python (FastAPI), NetworkX, SQLite, Redis Cluster
* **Frontend:** React 19, Vite, Tailwind CSS, Leaflet (Maps)
* **Database:** Supabase (PostgreSQL)
* **Weather:** Open-Meteo API
* **Geocoding:** Nominatim (OpenStreetMap)

---

## 📂 Project Structure

```text
para.v2/
├── main.py                  # FastAPI application entry point
├── api_routes.py            # Chat and upload endpoints
├── admin_routes.py          # Dashboard and management endpoints
├── graph_engine.py          # MultiDiGraph builder and pathfinder
├── llm_engine.py            # Intent parser + Gazetteer + POI resolver
├── models.py                # Pydantic models
├── geojson_data/            # Source *.geojson route files
├── commute_logs/            # Saved GPS tracks and session logs
├── para_poi.db              # SQLite POI cache 
├── para_ml_data.db          # Feedback and analytics store
└── frontend/                # Symlink to React frontend -> ~/para-frontend
```

## 🌐 Pages & User Flows

|Page|Route|Purpose|
|---|---|---|
|Home|`/`|Map + chat trip planner|
|Explore|`/explore`|Browse 50 verified + 892 reference routes|
|Contribute|`/contribute`|Guided journey recorder, route upload, POI|
|Community|`/community`|Forum with Markdown, comments, edits|
|Profile|`/profile`|Username, bio, badges, saved commutes|
|Weather|Modal|Live weather with 7-day forecast|
|Admin|`/admin`|Route doctor, inspector, approvals (role-gated)|

## 🔐 Environment Variables


```text
1. VITE_API_URL=https://para-ph-api.onrender.com
2. SUPABASE_URL=your-supabase-url
3. SUPABASE_SERVICE_KEY=your-supabase-key
```

## ⚡ Performance

- **10,000 request stress test:** 100% success, 0 failures
- **Throughput:** 29 req/sec sustained
- **P50 latency:** 483ms
- **P99 latency:** 8.1s (geocoding cold start)
- **Routes pre-geocoded:** 50 verified routes cached in database

## License

Copyright © 2026 PARA PH. All Rights Reserved.

## Contact

- **Email:** [para.ph.info@gmail.com](mailto:para.ph.info@gmail.com)
- **Website:** [https://para-commute.org](https://para-commute.org/)
