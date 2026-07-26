"""Structural integrity tests against the *real* production graph.

Unlike tests/unit/test_graph_engine.py (which exercises graph_engine.py's
logic against small synthetic fixtures), these tests build the actual graph
from backend/data/geojson_data and check properties that only show up at
real scale: connectivity, referential integrity, and coordinate sanity.

Data-Engineering Roadmap (docs/DATA_ENGINEERING_ROADMAP.md), Theme 9 /
Stage A item 4: "Add Phase-0 structural graph tests (SCC count, referential
integrity, load/route smoke test) to CI immediately."

These are marked `structural` and excluded from the default run (see
pyproject.toml) because building the full graph takes ~15-20s -- fast enough
for a dedicated CI job, but not something every `pytest` invocation should
pay for.

Baseline measured 2026-07-21, after fixing the walk_paths.geojson
mode-tagging bug (untyped OSM footway/path features were silently
defaulting to type="jeep" -- see graph_engine.py's _infer_vehicle_type):
    Nodes: 72,403   Edges: 1,812,216
    Weakly connected components: 1,904 (largest = 47.6% of nodes)
    All 49 distinct jeepney routes are reachable within the single largest
    component -- the ~52% of nodes outside it are pedestrian footway
    fragments (isolated sidewalk/footpath segments common in raw OSM data),
    not jeepney route disconnection. Route-level connectivity is the
    correctness property that actually matters for routing; raw node-count
    connectivity is tracked as a softer regression floor since footway mesh
    completeness is a separate, larger data-collection problem (tracked
    outside this test).
"""

import sys
from pathlib import Path

import networkx as nx
import pytest

BASE_DIR = Path(__file__).resolve().parent.parent.parent
GEOJSON_DATA_DIR = BASE_DIR / "data" / "geojson_data"

sys.path.insert(0, str(BASE_DIR))
from graph_engine import build_transit_graph  # noqa: E402

pytestmark = pytest.mark.structural

REQUIRED_EDGE_PROPS = {"distance", "time_min", "routing_weight", "route", "type"}
RECOGNIZED_EDGE_TYPES = {"jeep", "walk"}

# Generous Philippines bounding box -- wide enough to never false-positive on
# legitimate data, tight enough to catch gross errors like swapped lat/lng.
PH_LAT_RANGE = (4.0, 21.5)
PH_LNG_RANGE = (116.0, 127.0)

# Regression floors captured from the 2026-07-21 baseline above. Falling
# below these without a reviewed, intentional change to graph_engine.py or
# the source GeoJSON signals a new bug, not an existing known gap.
MIN_NODE_COUNT = 60_000
MIN_EDGE_COUNT = 1_500_000
MIN_DOMINANT_COMPONENT_COVERAGE = 0.40  # measured 47.6%; footway fragmentation is tracked separately

# Routes with a known, real geometry gap: most of the route sits in the
# dominant component, but a small fragment (5-99 nodes) breaks off because a
# stretch of traced coordinates has a >500m gap and trips the "no
# teleportation" rule in graph_engine.py's _process_line. This is a source
# GeoJSON data-quality issue (missing/sparse trace points along that
# stretch), not a code bug -- fixing it needs corrected route geometry, not
# a code change. Tracked as a follow-up; allowlisted here so the test still
# catches *new* route disconnections instead of being permanently red.
# Measured 2026-07-21: Malanday - Sta. Cruz (328/333 nodes in main
# component), Monumento-Meycauayan (153/203), Cogeo - Cubao via Marcos
# Hi-way (106/192).
KNOWN_PARTIALLY_DISCONNECTED_ROUTES = {
    "Malanday - Sta. Cruz",
    "Monumento-Meycauayan",
    "Cogeo - Cubao via Marcos Hi-way",
}


@pytest.fixture(scope="module")
def production_graph():
    return build_transit_graph(str(GEOJSON_DATA_DIR))


@pytest.fixture(scope="module")
def weakly_connected_components(production_graph):
    components = list(nx.weakly_connected_components(production_graph))
    components.sort(key=len, reverse=True)
    return components


def test_graph_builds_from_production_data(production_graph):
    assert production_graph.number_of_nodes() >= MIN_NODE_COUNT
    assert production_graph.number_of_edges() >= MIN_EDGE_COUNT


def test_no_dangling_edges(production_graph):
    """Every edge endpoint must be a real node (referential integrity)."""
    node_set = set(production_graph.nodes)
    dangling = [(u, v) for u, v in production_graph.edges() if u not in node_set or v not in node_set]
    assert dangling == []


def test_no_self_loop_edges(production_graph):
    self_loops = list(nx.selfloop_edges(production_graph))
    assert self_loops == [], f"{len(self_loops)} self-loop edges found, e.g. {self_loops[:5]}"


def test_no_zero_or_negative_distance_edges(production_graph):
    bad = [(u, v, d["distance"]) for u, v, d in production_graph.edges(data=True) if d.get("distance", 0) <= 0]
    assert bad == [], f"{len(bad)} edges with non-positive distance, e.g. {bad[:5]}"


def test_all_edges_have_required_properties(production_graph):
    missing = [(u, v) for u, v, d in production_graph.edges(data=True) if not REQUIRED_EDGE_PROPS.issubset(d.keys())]
    assert missing == [], f"{len(missing)} edges missing required properties, e.g. {missing[:5]}"


def test_all_edges_have_recognized_type(production_graph):
    """Catches mode-tagging regressions like the walk_paths bug this test module documents."""
    bad = [
        (u, v, d.get("type"))
        for u, v, d in production_graph.edges(data=True)
        if d.get("type") not in RECOGNIZED_EDGE_TYPES
    ]
    assert bad == [], f"{len(bad)} edges with an unrecognized 'type', e.g. {bad[:5]}"


def test_walk_transfer_edges_are_typed_walk(production_graph):
    bad = [
        (u, v, d.get("type"))
        for u, v, d in production_graph.edges(data=True)
        if d.get("route") == "WALK_TRANSFER" and d.get("type") != "walk"
    ]
    assert bad == [], f"{len(bad)} WALK_TRANSFER edges not typed 'walk', e.g. {bad[:5]}"


def test_node_coordinates_within_philippines_bounds(production_graph):
    out_of_bounds = [
        (n, d["lat"], d["lng"])
        for n, d in production_graph.nodes(data=True)
        if not (PH_LAT_RANGE[0] <= d["lat"] <= PH_LAT_RANGE[1] and PH_LNG_RANGE[0] <= d["lng"] <= PH_LNG_RANGE[1])
    ]
    assert out_of_bounds == [], f"{len(out_of_bounds)} nodes outside PH bounds, e.g. {out_of_bounds[:5]}"


def test_dominant_component_covers_regression_floor(production_graph, weakly_connected_components):
    largest = weakly_connected_components[0]
    coverage = len(largest) / production_graph.number_of_nodes()
    assert coverage >= MIN_DOMINANT_COMPONENT_COVERAGE, (
        f"Dominant weakly-connected component covers only {coverage:.1%} of nodes "
        f"(floor: {MIN_DOMINANT_COMPONENT_COVERAGE:.0%}). This is the raw node-count "
        f"metric, which is expected to sit well below 100% due to fragmented OSM "
        f"footway data -- see module docstring. A drop below the floor means new "
        f"disconnection, not the known footway-fragmentation gap."
    )


def test_all_jeepney_routes_reachable_within_dominant_component(production_graph, weakly_connected_components):
    """The correctness property that actually matters: can every jeepney route
    reach every other jeepney route? (As opposed to raw node coverage, which is
    dominated by disconnected pedestrian footway fragments -- see docstring.)

    If this test fails, block release: it means a jeepney route is functionally
    unreachable from the rest of the transit network, per the roadmap's own
    stated gate ("If graph SCC/WCC analysis shows a jeepney route isolated ->
    block release until connectivity fixed").
    """
    largest = weakly_connected_components[0]
    jeep_routes = {d["route"] for _, _, d in production_graph.edges(data=True) if d.get("type") == "jeep"}
    assert jeep_routes, "No jeepney routes found in the graph at all -- data source likely broken."

    unreachable_routes = set()
    for u, v, d in production_graph.edges(data=True):
        if d.get("type") == "jeep" and u not in largest and v not in largest:
            unreachable_routes.add(d["route"])

    newly_unreachable = unreachable_routes - KNOWN_PARTIALLY_DISCONNECTED_ROUTES
    assert newly_unreachable == set(), (
        f"{len(newly_unreachable)} jeepney routes are newly disconnected from the "
        f"dominant network component (not in the documented allowlist): {sorted(newly_unreachable)}"
    )

    # If a previously-broken route gets its geometry fixed, this will fail as
    # a reminder to shrink the allowlist above rather than leave it stale.
    resolved = KNOWN_PARTIALLY_DISCONNECTED_ROUTES - unreachable_routes
    assert resolved == set(), (
        f"{sorted(resolved)} are no longer disconnected -- remove from "
        f"KNOWN_PARTIALLY_DISCONNECTED_ROUTES, this allowlist is stale."
    )


def test_sample_jeepney_od_pairs_route_without_exception(production_graph, weakly_connected_components):
    """Load/route smoke test: sampled origin-destination pairs across distinct
    jeepney routes within the dominant component must resolve to a path.
    """
    largest = weakly_connected_components[0]
    jeep_nodes_by_route = {}
    for u, v, d in production_graph.edges(data=True):
        if d.get("type") == "jeep" and u in largest and v in largest:
            jeep_nodes_by_route.setdefault(d["route"], set()).update((u, v))

    routes = sorted(jeep_nodes_by_route)
    assert len(routes) >= 2, "Need at least 2 distinct jeepney routes to sample cross-route O-D pairs."

    sample_size = min(10, len(routes) - 1)
    failures = []
    for i in range(sample_size):
        origin_route, dest_route = routes[i], routes[i + 1]
        origin = next(iter(jeep_nodes_by_route[origin_route]))
        dest = next(iter(jeep_nodes_by_route[dest_route]))
        try:
            nx.shortest_path(production_graph, origin, dest, weight="routing_weight")
        except nx.NetworkXNoPath:
            failures.append((origin_route, dest_route))

    assert failures == [], f"No path found for {len(failures)} sampled route pairs: {failures}"
