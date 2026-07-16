# 🚐 Para PH Routing Engine (v1.0)

**Para PH** is a lightweight, multimodal transit routing engine designed specifically for the unique public transportation network of the Philippines (Jeepneys, LRT, MRT, UV Express, and Buses). 

Version 1.0 focuses on the core spatial routing algorithm, automatic transfer detection, and an interactive map-based user interface.

## ✨ Features (v1.0)
* **Smart Spatial Graph Generation:** Automatically parses GeoJSON `MultiLineString` and `LineString` data to build a dense, routable NetworkX graph.
* **Automatic Transfer Detection:** Uses a spatial hash grid to detect intersections and parallel routes, automatically generating "walking transfer" edges between different transit lines.
* **Multimodal Support:** Handles different transit modes (Jeep, LRT, MRT, Bus) with mode-specific speed weights and transfer penalties.
* **Optimized Pathfinding:** Uses Dijkstra's algorithm to find the mathematically shortest path while applying penalties to minimize unnecessary transfers.
* **Interactive UI:** A responsive, mobile-friendly frontend built with React, Tailwind CSS, and Leaflet.js that draws color-coded, road-hugging polylines.

## 🛠️ Tech Stack
* **Backend:** Python, FastAPI, NetworkX, Pydantic
* **Frontend:** React (via Babel standalone), Leaflet.js, Tailwind CSS
* **Data:** GeoJSON (OpenStreetMap / Custom GIS exports)

## 🚀 Getting Started

### Prerequisites
* Python 3.9+
* A GeoJSON file containing transit routes (e.g., `routes.geojson`) placed in the root directory.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/para-ph-routing.git
   cd para-ph-routing

## Recommended Setup
### Create a Virtual Environment

    ``` 
      python -m venv venv
        source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ``` 

### Install Dependencies
    ``` 
        pip install -r requirements.txt
    ``` 
### Start
    ``` 
    python main.py
    ```


