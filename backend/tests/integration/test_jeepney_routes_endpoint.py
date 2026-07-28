import pytest

import api_routes

FIXTURE_PATH = api_routes.Path(__file__).resolve().parent.parent / "fixtures_jeepney" / "sample_jeepney_routes.geojson"


@pytest.fixture(autouse=True)
def jeepney_routes_fixture(monkeypatch):
    """Point the catalog at the small test fixture instead of the real 51-route file, and clear the cache."""
    monkeypatch.setattr(api_routes, "JEEPNEY_ROUTES_PATH", FIXTURE_PATH)
    monkeypatch.setattr(api_routes, "_jeepney_routes_cache", None)
    yield
    monkeypatch.setattr(api_routes, "_jeepney_routes_cache", None)


def test_list_jeepney_routes_returns_route_no_and_name(client):
    response = client.get("/api/v1/jeepney-routes")

    assert response.status_code == 200
    body = response.json()
    assert body == [
        {"Route_No": 1, "Route_Name": "UP - IKOT"},
        {"Route_No": 2, "Route_Name": "Cubao - Divisoria"},
    ]


def test_manifest_returns_verified_list_and_route_no_lookup(client):
    response = client.get("/api/v1/jeepney-routes/manifest")

    assert response.status_code == 200
    body = response.json()
    assert body["verified"] == [
        {"key": "1", "name": "UP - IKOT", "notes": "Weekday Path"},
        {"key": "2", "name": "Cubao - Divisoria", "notes": ""},
    ]
    assert body["byRouteNo"] == {"1": "1", "2": "2"}


def test_geometry_returns_the_matching_feature(client):
    response = client.get("/api/v1/jeepney-routes/1/geometry")

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "Feature"
    assert body["properties"]["route_long_name"] == "UP - IKOT"
    assert body["geometry"]["type"] == "MultiLineString"


def test_geometry_404s_for_unknown_key(client):
    response = client.get("/api/v1/jeepney-routes/does-not-exist/geometry")

    assert response.status_code == 404
