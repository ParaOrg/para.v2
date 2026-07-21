from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
import llm_engine
import main
from graph_engine import build_transit_graph

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def test_graph():
    """A small, deterministic transit graph built from the fixture GeoJSON."""
    return build_transit_graph(str(FIXTURES_DIR))


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Point every module's DB path constants at an isolated temp DB and create the schema."""
    db_path = tmp_path / "test_para.db"
    poi_db_path = tmp_path / "test_poi.db"

    monkeypatch.setattr(main, "DB_PATH", db_path)
    monkeypatch.setattr(api_routes, "DB_PATH", db_path)
    monkeypatch.setattr(llm_engine, "ML_DB_PATH", db_path)
    monkeypatch.setattr(llm_engine, "POI_DB_PATH", poi_db_path)

    main.init_db()
    return db_path


@pytest.fixture
def client(test_graph, isolated_db):
    """A TestClient wired to the router directly (no lifespan -> no real Ollama/network calls)."""
    app = FastAPI()
    app.state.G = test_graph
    app.include_router(api_routes.router)
    return TestClient(app)


@pytest.fixture
def mock_llm(monkeypatch):
    """Replace the network-calling LLM/geocoding functions used by api_routes with mocks."""
    geocode_mock = AsyncMock()
    intent_mock = AsyncMock()
    info_mock = AsyncMock()
    monkeypatch.setattr(api_routes, "geocode_location", geocode_mock)
    monkeypatch.setattr(api_routes, "parse_chat_intent_async", intent_mock)
    monkeypatch.setattr(api_routes, "ask_info_llm", info_mock)
    return {
        "geocode_location": geocode_mock,
        "parse_chat_intent_async": intent_mock,
        "ask_info_llm": info_mock,
    }
