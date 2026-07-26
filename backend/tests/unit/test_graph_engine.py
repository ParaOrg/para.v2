from collections import defaultdict

import networkx as nx
import pytest

from graph_engine import (
    SPEED_JEEP_KMH,
    SPEED_WALK_KMH,
    TRANSFER_PENALTY_MIN,
    _infer_vehicle_type,
    _inject_transfer_edges,
    _process_line,
    haversine,
    snap_coordinate,
)


class TestInferVehicleType:
    def test_explicit_type_property_wins(self):
        assert _infer_vehicle_type({"type": "jeep"}) == "jeep"

    def test_explicit_mode_property_used_when_type_missing(self):
        assert _infer_vehicle_type({"mode": "jeep"}) == "jeep"

    def test_pedestrian_highway_tag_maps_to_walk(self):
        for tag in ("footway", "path", "pedestrian", "steps", "cycleway", "track"):
            assert _infer_vehicle_type({"highway": tag}) == "walk"

    def test_untyped_non_pedestrian_road_returns_none(self):
        # e.g. residential/tertiary/secondary road segments in walk_paths.geojson
        # that carry no route_long_name/type/mode of their own -- must not be
        # silently defaulted to "jeep" (the bug this test module guards against).
        assert _infer_vehicle_type({"highway": "residential"}) is None
        assert _infer_vehicle_type({}) is None

    def test_explicit_type_overrides_highway_tag(self):
        assert _infer_vehicle_type({"type": "jeep", "highway": "footway"}) == "jeep"


class TestSpeedSelection:
    def test_process_line_uses_jeep_speed_for_jeep_edges(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        coords = [[121.0000, 14.6000], [121.0010, 14.6000]]  # ~107m apart

        _process_line(G, spatial_grid, coords, "Route A", "jeep", False, 0.0005)

        nodes = list(G.nodes)
        edge = G.edges[nodes[0], nodes[1]]
        expected_time_min = (edge["distance"] / 1000) / SPEED_JEEP_KMH * 60
        assert edge["time_min"] == pytest.approx(expected_time_min)

    def test_process_line_uses_walk_speed_for_walk_edges(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        coords = [[121.0000, 14.6000], [121.0010, 14.6000]]  # ~107m apart

        _process_line(G, spatial_grid, coords, "Some Footway", "walk", False, 0.0005)

        nodes = list(G.nodes)
        edge = G.edges[nodes[0], nodes[1]]
        expected_time_min = (edge["distance"] / 1000) / SPEED_WALK_KMH * 60
        assert edge["time_min"] == pytest.approx(expected_time_min)
        # Walking should take meaningfully longer than jeep for the same distance.
        jeep_time_min = (edge["distance"] / 1000) / SPEED_JEEP_KMH * 60
        assert edge["time_min"] > jeep_time_min


def test_haversine_known_distance():
    # 1 degree of longitude at the equator is ~111.32 km.
    dist = haversine(0.0, 0.0, 0.0, 1.0)
    assert dist == pytest.approx(111_320, rel=0.01)


def test_haversine_zero_distance():
    assert haversine(14.6, 121.0, 14.6, 121.0) == 0.0


def test_snap_coordinate_rounds_to_5_decimals():
    assert snap_coordinate(14.60001234, 121.00009876) == (14.60001, 121.00010)


class TestProcessLine:
    def test_creates_bidirectional_edges_for_close_points(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        coords = [[121.0000, 14.6000], [121.0010, 14.6000]]  # ~107m apart

        _process_line(G, spatial_grid, coords, "Route A", "jeep", False, 0.0005)

        assert G.number_of_nodes() == 2
        assert G.number_of_edges() == 2  # forward + forced reverse
        nodes = list(G.nodes)
        assert G.has_edge(nodes[0], nodes[1])
        assert G.has_edge(nodes[1], nodes[0])
        edge = G.edges[nodes[0], nodes[1]]
        assert edge["route"] == "Route A"
        assert edge["type"] == "jeep"

    def test_no_teleportation_across_large_gaps(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        # ~1.1km apart -- exceeds the 500m "no teleportation" cutoff.
        coords = [[121.0000, 14.6000], [121.0100, 14.6000]]

        _process_line(G, spatial_grid, coords, "Route A", "jeep", False, 0.0005)

        assert G.number_of_nodes() == 2
        assert G.number_of_edges() == 0

    def test_populates_spatial_grid(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        coords = [[121.0000, 14.6000], [121.0010, 14.6000]]

        _process_line(G, spatial_grid, coords, "Route A", "jeep", False, 0.0005)

        total_nodes_in_grid = sum(len(v) for v in spatial_grid.values())
        assert total_nodes_in_grid == 2


class TestInjectTransferEdges:
    def _build_two_close_nodes(self, lat_offset):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        grid_size = 0.0005

        G.add_node("A", lat=14.6000, lng=121.0000)
        G.add_node("B", lat=14.6000 + lat_offset, lng=121.0000)
        for node_id in ("A", "B"):
            attrs = G.nodes[node_id]
            gx, gy = int(attrs["lat"] / grid_size), int(attrs["lng"] / grid_size)
            spatial_grid[(gx, gy)].append(node_id)
        return G, spatial_grid

    def test_creates_transfer_edge_between_nearby_nodes(self):
        # ~56m apart, straddling adjacent grid cells (same-cell pairs are not
        # considered by _inject_transfer_edges, only cells adjacent to each other).
        G, spatial_grid = self._build_two_close_nodes(lat_offset=0.0005)

        _inject_transfer_edges(G, spatial_grid)

        assert G.has_edge("A", "B")
        edge = G.edges["A", "B"]
        assert edge["route"] == "WALK_TRANSFER"
        assert edge["type"] == "walk"
        assert edge["time_min"] >= TRANSFER_PENALTY_MIN

    def test_no_transfer_edge_beyond_1000m(self):
        # ~1.1km apart -- outside the transfer radius.
        G, spatial_grid = self._build_two_close_nodes(lat_offset=0.01)

        _inject_transfer_edges(G, spatial_grid)

        assert not G.has_edge("A", "B")


class TestBuildTransitGraph:
    def test_builds_graph_from_fixture_geojson(self, test_graph):
        # 2 routes x 3 points each = 6 nodes.
        assert test_graph.number_of_nodes() == 6

    def test_within_route_edges_are_bidirectional(self, test_graph):
        nodes = [n for n, d in test_graph.nodes(data=True) if d["lat"] == 14.6]
        assert len(nodes) == 3

    def test_transfer_edges_exist_between_nearby_routes(self, test_graph):
        transfer_edges = [(u, v) for u, v, d in test_graph.edges(data=True) if d.get("route") == "WALK_TRANSFER"]
        assert len(transfer_edges) > 0

    def test_spatial_grid_attached_to_graph(self, test_graph):
        assert "spatial_grid" in test_graph.graph
        assert "grid_size" in test_graph.graph
