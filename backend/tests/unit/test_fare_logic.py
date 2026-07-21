import networkx as nx
import pytest

from api_routes import _calculate_route_from_path


def _make_graph(edges):
    """edges: list of (u, v, distance_m, time_min, type, route) tuples."""
    G = nx.DiGraph()
    node_id = 0
    coords_seen = {}
    for u, v, dist, time_min, vtype, route in edges:
        for n in (u, v):
            if n not in coords_seen:
                node_id += 1
                coords_seen[n] = (121.0 + node_id * 0.001, 14.5 + node_id * 0.001)
    for n, (lng, lat) in coords_seen.items():
        G.add_node(n, lat=lat, lng=lng)
    for u, v, dist, time_min, vtype, route in edges:
        G.add_edge(u, v, distance=dist, time_min=time_min, type=vtype, route=route)
    return G


def test_single_continuous_jeep_ride_charges_fare_once():
    # 2km total across two edges of the same route/type -- must be ONE segment, ONE fare.
    G = _make_graph(
        [
            ("n1", "n2", 1000.0, 5.0, "jeep", "Route A"),
            ("n2", "n3", 1000.0, 5.0, "jeep", "Route A"),
        ]
    )

    result = _calculate_route_from_path(G, ["n1", "n2", "n3"])

    assert len(result.steps) == 1
    assert result.total_distance_m == 2000.0
    # 2km <= 4km base coverage -> flat base fare only.
    assert result.total_fare == pytest.approx(13.0)
    assert result.steps[0].vehicle_type == "jeep"


def test_jeep_beyond_4km_adds_distance_surcharge():
    G = _make_graph([("n1", "n2", 5000.0, 15.0, "jeep", "Route A")])

    result = _calculate_route_from_path(G, ["n1", "n2"])

    # base 13 + (5km - 4km) * 2.5
    assert result.total_fare == pytest.approx(13.0 + 1.0 * 2.5)


def test_walk_segments_are_free():
    G = _make_graph([("n1", "n2", 300.0, 4.5, "walk", "WALK_TRANSFER")])

    result = _calculate_route_from_path(G, ["n1", "n2"])

    assert result.total_fare == 0.0
    assert result.steps[0].action == "walk"


def test_transfer_via_walk_charges_fare_per_ride():
    # jeep -> walk -> jeep: two separate rides, two base fares.
    G = _make_graph(
        [
            ("n1", "n2", 1000.0, 5.0, "jeep", "Route A"),
            ("n2", "n3", 200.0, 4.0, "walk", "WALK_TRANSFER"),
            ("n3", "n4", 1000.0, 5.0, "jeep", "Route B"),
        ]
    )

    result = _calculate_route_from_path(G, ["n1", "n2", "n3", "n4"])

    assert len(result.steps) == 3
    assert result.total_fare == pytest.approx(13.0 + 0.0 + 13.0)
    actions = [s.action for s in result.steps]
    assert actions == ["board", "walk", "board"]


def test_direct_vehicle_type_change_without_walk_is_a_transfer():
    # jeep -> lrt directly (no walk edge between them).
    G = _make_graph(
        [
            ("n1", "n2", 1000.0, 5.0, "jeep", "Route A"),
            ("n2", "n3", 2000.0, 6.0, "lrt", "LRT-1"),
        ]
    )

    result = _calculate_route_from_path(G, ["n1", "n2", "n3"])

    actions = [s.action for s in result.steps]
    assert actions == ["board", "transfer"]


def test_missing_edge_in_path_is_skipped():
    G = _make_graph([("n1", "n2", 1000.0, 5.0, "jeep", "Route A")])
    # n2 -> n3 has no edge in the graph -- should be skipped, not raise.
    G.add_node("n3", lat=14.7, lng=121.1)

    result = _calculate_route_from_path(G, ["n1", "n2", "n3"])

    assert len(result.steps) == 1
    assert result.success is True
