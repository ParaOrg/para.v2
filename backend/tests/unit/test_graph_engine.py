from collections import defaultdict

import networkx as nx
import pytest

from graph_engine import (
    FARE_MRT3_MAX_PHP,
    FARE_MRT3_MIN_PHP,
    RAIL_PROMO_DISCOUNT_MULTIPLIER,
    SPEED_JEEP_KMH,
    SPEED_WALK_KMH,
    TRANSFER_PENALTY_MIN,
    _infer_vehicle_type,
    _inject_transfer_edges,
    _process_line,
    bearing_to_compass,
    calculate_fare,
    compass_to_bound,
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

    def test_forward_and_reverse_edges_have_opposite_directions(self):
        G = nx.DiGraph()
        spatial_grid = defaultdict(list)
        coords = [[121.0000, 14.6000], [121.0000, 14.6010]]  # due north

        _process_line(G, spatial_grid, coords, "Route A", "jeep", False, 0.0005)

        nodes = list(G.nodes)
        forward = G.edges[nodes[0], nodes[1]]
        reverse = G.edges[nodes[1], nodes[0]]
        assert forward["direction"] != reverse["direction"]
        assert forward["direction"] == "N"
        assert reverse["direction"] == "S"

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


class TestCalculateFare:
    def test_jeep_matches_existing_base_plus_distance_formula(self):
        assert calculate_fare("jeep", 2000) == pytest.approx(13.0)
        assert calculate_fare("jeep", 5000) == pytest.approx(13.0 + 1.0 * 2.5)

    def test_walk_is_free(self):
        assert calculate_fare("walk", 5000) == 0.0

    def test_uv_express_and_bus_prov_have_no_verified_formula_yet(self):
        # No fabricated numbers for modes without verified route/fare data.
        assert calculate_fare("uv_express", 5000) == 0.0
        assert calculate_fare("bus_prov", 5000) == 0.0

    def test_bus_city_matches_carousel_formula(self):
        # P15 base for <=5km, no surcharge yet at exactly 5km.
        assert calculate_fare("bus_city", 4000) == pytest.approx(15.0)
        # +P2.65/km beyond 5km.
        assert calculate_fare("bus_city", 6000) == pytest.approx(15.0 + 1.0 * 2.65)

    def test_lrt1_uses_boarding_plus_per_km_formula(self):
        assert calculate_fare("lrt1", 0) == pytest.approx(16.25)
        assert calculate_fare("lrt1", 10_000) == pytest.approx(16.25 + 10 * 1.47)

    def test_mrt3_interpolates_between_min_and_max_by_distance_fraction(self):
        assert calculate_fare("mrt3", 0) == pytest.approx(FARE_MRT3_MIN_PHP * RAIL_PROMO_DISCOUNT_MULTIPLIER)
        # Beyond the modeled line length, fare is capped at the (discounted) max.
        assert calculate_fare("mrt3", 100_000) == pytest.approx(FARE_MRT3_MAX_PHP * RAIL_PROMO_DISCOUNT_MULTIPLIER)

    def test_unrecognized_mode_returns_zero_rather_than_guessing(self):
        assert calculate_fare("hoverboard", 1000) == 0.0


class TestDirectionality:
    def test_bearing_to_compass_cardinal_directions(self):
        # Moving due north: lat increases, lng constant.
        assert bearing_to_compass(14.0, 121.0, 14.1, 121.0) == "N"
        # Moving due south.
        assert bearing_to_compass(14.1, 121.0, 14.0, 121.0) == "S"
        # Moving due east: lng increases, lat constant (near-equator so latitude
        # scaling distortion is negligible).
        assert bearing_to_compass(1.0, 121.0, 1.0, 121.1) == "E"
        # Moving due west.
        assert bearing_to_compass(1.0, 121.1, 1.0, 121.0) == "W"

    def test_bearing_is_reversed_for_the_opposite_direction_of_travel(self):
        forward = bearing_to_compass(14.0, 121.0, 14.1, 121.0)
        backward = bearing_to_compass(14.1, 121.0, 14.0, 121.0)
        assert forward != backward

    def test_compass_to_bound_maps_known_directions(self):
        assert compass_to_bound("N") == "Northbound"
        assert compass_to_bound("S") == "Southbound"

    def test_compass_to_bound_handles_none(self):
        assert compass_to_bound(None) is None


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
