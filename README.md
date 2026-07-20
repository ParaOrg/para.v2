# 🚐 Para PH: AI-Powered Multimodal Transit Routing Engine (v1.1.2)
Para PH is a lightweight, self-learning, multimodal transit routing engine designed specifically for the unique and chaotic public transportation network of the Philippines (Jeepneys, LRT, MRT, UV Express, and Buses).
Moving beyond static map algorithms, Para PH uses local Large Language Models (LLMs) for natural language understanding, crowdsourced machine learning to memorize commuter-approved routes, and commuter-realistic math to minimize painful transfers.

## ✨ Key Features (v1.1.2)

**🧠 AI & Natural Language Processing:** Understands Taglish and local slang (e.g., "From admu to ust"). Uses a local Llama 3.2 model for intent parsing, with a robust regex fallback if offline.

**📈 Self-Learning ML Engine:** Features a crowdsourced "Mode Recommender." When users rate a route 👍, the exact path is saved. Future queries for that route instantly retrieve the "Commuter Favorite" without heavy graph math.

**🚐 Commuter-Realistic Routing:**
- **Segment-Based Fares:** Groups consecutive GPS nodes into single rides, ensuring you are only charged the ₱13 jeepney base fare once per continuous ride, not per GPS dot.
- **Massive Transfer Penalty:** Applies a 30-minute time penalty to vehicle transfers, forcing the algorithm to aggressively prioritize direct routes over illogical multi-hop shortcuts.

**⚡ Guaranteed Alternative Routes:** Uses the industry-standard "Edge Penalty Method" to instantly generate a visually distinct, grey backup route in case the primary path is congested.

**📍 Smart Geocoding & Memory:** Features "Lazy LLM Expansion" and an "Acronym Buster" cache. If you type "pitx", it instantly translates and caches it, ensuring zero-latency lookups on subsequent searches.

**🗺️ Interactive Step-by-Step UI:** A responsive, mobile-first React frontend (Vite, React Router, Tailwind CSS) with a full page set — Home, Map, Routes Explorer, Gas Prices, Login/Signup, About, Contact — rendering color-coded polylines, collapsible step-by-step itineraries, and the ML feedback interface.

## 🛠️ Tech Stack
**Backend:** Python, FastAPI, NetworkX, Pydantic, SQLite

**AI & Geocoding:** Ollama (Llama 3.2), HTTPX, Geopy (Nominatim)

**Frontend:** React 19, Vite 7, React Router 7, Tailwind CSS v4, Firebase Auth, Supabase, Google Maps

**Data:** GeoJSON (OpenStreetMap / Custom GIS exports), Spatial Hash Grids

## 📁 Project Structure

```
para.v2/
├── frontend/     # React/Vite SPA — see frontend/.env.example for required env vars
├── backend/      # FastAPI routing engine (main.py, api_routes.py, graph_engine.py, llm_engine.py, models.py)
│   ├── scripts/  # One-off data prep/debug scripts
│   └── data/     # geojson_data/, Future/, knowledge_base.txt (SQLite dbs are created here at runtime)
└── legacy/       # Archived single-file demo (pre-frontend-migration UI)
```

## 🚀 Getting Started
1. Prerequisites
- Python 3.9+
- Node.js 20+ (for the frontend)
- Ollama installed and running in the background (for AI features).
- GeoJSON files containing transit routes placed in `backend/data/geojson_data/`.

## Installation — Backend

```
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Prepare the AI (optional but recommended) — ensure Ollama is running and download the lightweight Llama 3.2 model:

```
ollama pull llama3.2
```

Start the backend:

```
python main.py
```

This serves the API on `http://localhost:8000` (and the archived legacy demo at `/`).

## Installation — Frontend

```
cd frontend
npm install
cp .env.example .env.local   # fill in your own Firebase/Supabase/Google Maps keys
npm run dev
```

This serves the app on `http://localhost:5173`. `frontend/src/config/api.js` defaults API calls to `http://localhost:8000` in dev — override with `VITE_API_BASE_URL` if needed.

## 📊 How the ML Learning Engine Works
1. The user requests a route (e.g., "Cubao to Ayala").
2. The backend calculates the optimal path using composite weights (Time + Distance + Transfer Penalties).
3. The UI displays the route with a 👍 (7/Perfect), 😐 (3/Okay), or 👎 (1/Bad) rating system.
4. If the user clicks 👍, the backend saves the exact node path to the approved_routes table.
5. The next time any user requests "Cubao to Ayala", the backend bypasses the math and instantly serves the community-approved route.

## 🔮 Roadmap (v1.2)
**Live Deviation Tracking:** Browser *watchPosition* API to alert users if they veer off the approved route.

**Incident Broadcasting:** WebSocket integration allowing users to report "Baha" (Flood) or "Walang Sakay" (No Fares) at specific nodes, dynamically updating edge weights in real-time.

**POI Autocomplete:** A live, fuzzy-search dropdown in the chat UI powered by the 56,000+ ingested OpenStreetMap points.

# Important Notes
1. The path mixes routes, notable bridge and road paths.
- Does not know proper exits out of establishments, leading to weird path generation
- The fix: manual route mapping of proper exits, campus maps, or online databases.
2. Does not follow road rules just yet.

*Para PH v1.1.1 - Built by commuters, for commuters. 🇵🇭🚐*
