import json
import sqlite3
from collections import defaultdict

import networkx as nx
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
from graph_engine import snap_coordinate


def test_info_intent_returns_llm_answer(client, mock_llm):
    mock_llm["parse_chat_intent_async"].return_value = {"intent": "INFO", "question": "Anong oras?"}
    mock_llm["ask_info_llm"].return_value = "5am hanggang 10pm."

    response = client.post("/chat", json={"user_id": "u1", "message": "Anong oras magbukas?"})

    assert response.status_code == 200
    body = response.json()
    assert body["reply_text"] == "5am hanggang 10pm."
    assert body["route_data"] is None


def test_route_intent_missing_origin_or_destination(client, mock_llm):
    mock_llm["parse_chat_intent_async"].return_value = {"intent": "ROUTE", "origin": "", "destination": "alabang"}

    response = client.post("/chat", json={"user_id": "u1", "message": "??"})

    assert response.status_code == 200
    assert response.json()["route_data"] is None


def test_route_intent_unresolvable_location_returns_friendly_message(client, mock_llm):
    mock_llm["parse_chat_intent_async"].return_value = {
        "intent": "ROUTE",
        "origin": "nowhere",
        "destination": "alabang",
    }
    mock_llm["geocode_location"].side_effect = [None, (14.6, 121.0)]

    response = client.post("/chat", json={"user_id": "u1", "message": "nowhere to alabang"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_data"] is None
    assert "Hindi ko mahanap" in body["reply_text"]


def test_route_intent_computes_primary_route(client, mock_llm):
    mock_llm["parse_chat_intent_async"].return_value = {"intent": "ROUTE", "origin": "start", "destination": "end"}
    mock_llm["geocode_location"].side_effect = [(14.6000, 121.0000), (14.6000, 121.0020)]

    response = client.post("/chat", json={"user_id": "u1", "message": "start to end"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_data"] is not None
    assert body["route_data"]["success"] is True
    assert len(body["route_data"]["steps"]) > 0
    assert body["route_data"]["total_fare"] > 0


def test_route_intent_uses_commuter_favorite_when_highly_rated(client, mock_llm, isolated_db):
    origin, destination = "start", "end"
    path_nodes = [
        str(snap_coordinate(14.6000, 121.0000)),
        str(snap_coordinate(14.6000, 121.0010)),
        str(snap_coordinate(14.6000, 121.0020)),
    ]
    db = sqlite3.connect(str(isolated_db))
    db.execute(
        """
        INSERT INTO approved_routes (origin, destination, path_nodes, total_fare, total_time, rating_sum, trip_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (origin, destination, json.dumps(path_nodes), 13.0, 10.0, 7, 1),
    )
    db.commit()
    db.close()

    mock_llm["parse_chat_intent_async"].return_value = {"intent": "ROUTE", "origin": origin, "destination": destination}
    mock_llm["geocode_location"].side_effect = [(14.6000, 121.0000), (14.6000, 121.0020)]

    response = client.post("/chat", json={"user_id": "u1", "message": "start to end"})

    assert response.status_code == 200
    body = response.json()
    assert "Commuter Favorite" in body["route_data"]["message"]
    assert body["alternatives"] == []


def _disconnected_graph():
    """Two clusters of nodes with no path between them, for a deterministic 'no route' case."""
    G = nx.DiGraph()
    grid_size = 0.0005
    spatial_grid = defaultdict(list)

    clusters = {
        "c1": (14.6000, 121.0000),
        "c2": (14.6001, 121.0001),
        "c3": (0.0000, 0.0000),
        "c4": (0.0001, 0.0001),
    }
    for node_id, (lat, lng) in clusters.items():
        G.add_node(node_id, lat=lat, lng=lng)
        gx, gy = int(lat / grid_size), int(lng / grid_size)
        spatial_grid[(gx, gy)].append(node_id)

    G.add_edge("c1", "c2", distance=50.0, time_min=1.0, routing_weight=1.0, route="Route A", type="jeep")
    G.add_edge("c2", "c1", distance=50.0, time_min=1.0, routing_weight=1.0, route="Route A", type="jeep")
    G.add_edge("c3", "c4", distance=50.0, time_min=1.0, routing_weight=1.0, route="Route B", type="jeep")
    G.add_edge("c4", "c3", distance=50.0, time_min=1.0, routing_weight=1.0, route="Route B", type="jeep")

    G.graph["spatial_grid"] = spatial_grid
    G.graph["grid_size"] = grid_size
    return G


def test_route_intent_no_path_found(isolated_db, mock_llm):
    app = FastAPI()
    app.state.G = _disconnected_graph()
    app.include_router(api_routes.router)
    disconnected_client = TestClient(app)

    mock_llm["parse_chat_intent_async"].return_value = {"intent": "ROUTE", "origin": "start", "destination": "end"}
    mock_llm["geocode_location"].side_effect = [(14.6000, 121.0000), (0.0000, 0.0000)]

    response = disconnected_client.post("/chat", json={"user_id": "u1", "message": "start to end"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_data"] is None
    assert "Walang nakitang ruta" in body["reply_text"]
