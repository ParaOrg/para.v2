# Rail & Bus Multimodal Data — Sources, Confidence, Known Gaps

> Compiled 2026-07-27 for the mode-diversity / multimodal-fare work on `SystemsMergedExp`. Read this before trusting or editing `backend/data/geojson_data/rail_bus/*.geojson` or the fare constants in `backend/graph_engine.py`.

## What was added

| File | Mode | Stations | Confidence |
|---|---|---|---|
| `rail_bus/mrt3.geojson` | `mrt3` | 13 (North Avenue ↔ Taft Avenue) | High |
| `rail_bus/lrt1.geojson` | `lrt1` | 20 mainline (FPJ ↔ Baclaran) + 5 Cavite Extension | High (mainline) / Medium (extension) |
| `rail_bus/lrt2.geojson` | `lrt2` | 15 (Pier 4/Recto ↔ Antipolo) | High |
| `rail_bus/bus_carousel.geojson` | `bus_city` | 24 named stops, 12 wired into the routable graph | High (12 rail-anchored stops) / Medium-Low (remaining 12) |

## Sources

- **Station coordinates (MRT-3, LRT-1, LRT-2):** Wikidata, queried live via SPARQL against `wdt:P81` (line membership) and `wdt:P625` (coordinate) for `Q13422345` (MRT-3), `Q4165124` (LRT-1), `Q4165317` (LRT-2). Cross-checked station **order** against the Wikipedia articles for each line. Coordinates were sanity-checked for geographic plausibility (monotonic latitude progression along the known corridor) before use.
- **EDSA Carousel stop order:** Wikipedia "EDSA Carousel" article (24 stops, Monumento ↔ PITX).
- **EDSA Carousel coordinates:** reused directly from the MRT-3/LRT-1 datasets above where a Carousel stop is co-located with a rail station (12 of 24 — high confidence). The remaining 12 were geocoded from place names via OpenStreetMap Nominatim; a few of those geocodes looked imprecise or landed on a generic nearby POI rather than the exact busway platform — those are flagged `"coordinate_confidence": "low"` in the GeoJSON and were **not** wired into the routable line. `DFA/Shell-Starbucks` has no coordinate at all rather than a guessed one.
- **Fares:**
  - MRT-3: official fare page (mrt3.com) — ₱13–₱28 single journey, displayed as a station-pair image matrix (not machine-readable), so `graph_engine.calculate_fare` interpolates linearly by distance between those two anchors rather than reproducing the exact posted matrix.
  - LRT-1: a real published formula for the Cavite Extension (₱16.25 boarding + ₱1.47/km), used directly.
  - LRT-2: official min/max (₱13 / ₱33, Aug 2023 adjustment, still current per Jan 2026 sources), same distance-interpolation approach as MRT-3.
  - EDSA Carousel: LTFRB-regulated formula (₱15 base for first 5 km + ₱2.65/km beyond), used directly.
  - **50% DOTr fare discount for LRT-2 and MRT-3, effective 2026-03-23** (confirmed via lrta.gov.ph): applied via `RAIL_PROMO_DISCOUNT_ACTIVE` in `graph_engine.py`. This is a promo, not a fare restructure — revisit and turn it off once the promo lapses; don't let it silently go stale.

## Known gaps — not fabricated, flagged instead

1. **LRT-1 Cavite Extension operational status is ambiguous.** Public sources disagree on whether Dr. Santos is the current southern terminus or whether service already runs further (Zapote/Talaba have coordinates; Manuyo Uno/Las Piñas/Niog do not, in Wikidata as of this writing). The extension segment is included as a *separate* line feature tagged `"status": "extension_operational_status_unconfirmed_2026-07-27"` so it can be disabled or corrected without touching the verified mainline. The three stations with no coordinate at all were omitted rather than estimated.
2. **UV Express has no routable data.** There is no publicly available machine-readable (GeoJSON/GTFS) dataset of UV Express route geometry — LTFRB itself filed a Freedom-of-Information request in 2026 for this exact data, which is a strong signal it doesn't exist as an open dataset yet. A promising lead — **TUMI's "GTFS: Manila" feed** (`hub.tumidata.org/dataset/gtfs-manila`), reportedly compiled with LRTA/LTFRB/MRTC/PNR — was unreachable from this environment during this session (connection refused) and was not verified; worth a follow-up fetch before building on it. `graph_engine.SPEED_BY_TYPE_KMH` and `calculate_fare` already have `uv_express`/`bus_prov` entries so the schema is ready the moment real geometry exists — `calculate_fare` deliberately returns `0.0` for them today rather than a made-up number.
3. **Provincial buses:** same gap as UV Express, same schema readiness. This is also the strongest concrete argument for the community-geotracing feature (see `docs/COMMUNITY_DATA_ENTRY_DESIGN.md`) — riders tracing their own UV/provincial-bus trips is the realistic path to filling this, mirroring how Digital Matatus/Transport for Cairo built their networks (see `docs/DATA_ENGINEERING_ROADMAP.md` Theme 8).
4. **Rail geometry is straight-line, not true track alignment.** Only station coordinates are known; `densify()` (used when generating these files) linearly interpolates points every ~400m between stations so the graph's 500m no-teleportation rule doesn't drop every inter-station edge. Distance/time/fare estimates are therefore an approximation of the real curved alignment, usually an undercount for curvier stretches (e.g. LRT-2 around Marikina). Replacing this with real alignment polylines (OSM `railway=rail` ways, or Valhalla/OSM extraction) is a good follow-up.
5. **EDSA Carousel routable backbone is a subset.** Only the 12 rail-anchored stops are wired into the routable line; the 12 geocoded-only stops exist as station points (for display) but aren't part of the graph edges yet. Improving their coordinates (ideally from an official DOTr/Carousel GIS source rather than Nominatim) would let the whole line be wired in.

## How to regenerate

The generation script (one-off, not checked into the repo) lived at a scratch path during this session and hardcodes the coordinate tables above. If you need to regenerate `rail_bus/*.geojson` — e.g. after getting real Cavite Extension or Carousel coordinates — recreate a similar script rather than hand-editing the GeoJSON, and re-run `backend/tests/structural/test_graph_health.py` afterward to catch any new connectivity/referential-integrity issues.
