# 🚐 Para PH: AI-Powered Multimodal Transit Routing Engine (v1.1.1)
Para PH is a lightweight, self-learning, multimodal transit routing engine designed specifically for the unique and chaotic public transportation network of the Philippines (Jeepneys, LRT, MRT, UV Express, and Buses).
Moving beyond static map algorithms, Para PH uses local Large Language Models (LLMs) for natural language understanding, crowdsourced machine learning to memorize commuter-approved routes, and commuter-realistic math to minimize painful transfers.

## ✨ Key Features (v1.1.1)

**🧠 AI & Natural Language Processing:** Understands Taglish and local slang (e.g., "From admu to ust"). Uses a local Llama 3.2 model for intent parsing, with a robust regex fallback if offline.

**📈 Self-Learning ML Engine:** Features a crowdsourced "Mode Recommender." When users rate a route 👍, the exact path is saved. Future queries for that route instantly retrieve the "Commuter Favorite" without heavy graph math.

**🚐 Commuter-Realistic Routing:**
- **Segment-Based Fares:** Groups consecutive GPS nodes into single rides, ensuring you are only charged the ₱13 jeepney base fare once per continuous ride, not per GPS dot.
- **Massive Transfer Penalty:** Applies a 30-minute time penalty to vehicle transfers, forcing the algorithm to aggressively prioritize direct routes over illogical multi-hop shortcuts.

**⚡ Guaranteed Alternative Routes:** Uses the industry-standard "Edge Penalty Method" to instantly generate a visually distinct, grey backup route in case the primary path is congested.

**📍 Smart Geocoding & Memory:** Features "Lazy LLM Expansion" and an "Acronym Buster" cache. If you type "pitx", it instantly translates and caches it, ensuring zero-latency lookups on subsequent searches.

**🗺️ Interactive Step-by-Step UI:** A responsive, mobile-first frontend (React, Tailwind, Leaflet) that renders color-coded polylines, collapsible step-by-step itineraries, and the ML feedback interface.

## 🛠️ Tech Stack
**Backend:** Python, FastAPI, NetworkX, Pydantic, SQLite

**AI & Geocoding:** Ollama (Llama 3.2), HTTPX, Geopy (Nominatim)

**Frontend:** React (via Babel standalone), Leaflet.js, Tailwind CSS

**Data:** GeoJSON (OpenStreetMap / Custom GIS exports), Spatial Hash Grids

## 🚀 Getting Started
1. Prerequisites
- Python 3.9+
- Ollama installed and running in the background (for AI features).
- GeoJSON files containing transit routes placed in the ./geojson_data directory.

## Installation
1. Clone the repository:

```
git clone https://github.com/your-username/para-ph-routing.git
cd para-ph-routing
```

2. Create and activate a Virtual Environment:

```
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

3. Install Dependencies

```
pip freeze > requirements.txt
```

4. Prepare the AI (Optional but Recommended):
Ensure Ollama is running and download the lightweight Llama 3.2 model:

```
ollama pull llama3.2
```

5. Start the Server:

```
python main.py
```

6. Open the app through localhost

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

*Para PH v1.1.1 - Built by commuters, for commuters. 🇵🇭🚐*