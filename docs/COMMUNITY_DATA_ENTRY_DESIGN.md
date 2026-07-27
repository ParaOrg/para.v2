# Community Data Entry — Design Doc (Live Feed + Geotraced Data)

> Status: **design only, not implemented.** Per the 2026-07-27 planning session, this item was explicitly scoped as "design/plan for today" rather than code. Read alongside `docs/DATA_ENGINEERING_ROADMAP.md` Theme 7 (GPS ingestion + RA 10173 compliance) and Theme 8 (case studies) — this doc operationalizes those into a concrete plan rather than re-deriving them.

## Why this matters now, concretely

Today's data work hit a real, named gap: **UV Express and provincial bus routes have no publicly available machine-readable geometry** (see `docs/RAIL_BUS_DATA_SOURCES.md`). LTFRB itself filed a 2026 FOI request for this exact data — it doesn't exist as an open dataset. Every comparable project that solved this (Digital Matatus/Nairobi, Transport for Cairo, Sakay.ph/Manila) solved it the same way: **volunteers/commuters traced real trips with a phone, and the routes were built from those traces**, not from official records. Community data entry isn't a "nice to have" feature — for PARA it's the *only* realistic path to ever closing the UV/provincial-bus gap, and it's also the open-source/advocacy goal in its own right.

## Two distinct data types (don't conflate them)

1. **Structured corrections** — a rider reports something wrong or missing: a route's fare changed, a jeepney no longer serves a stretch, a stop moved, a new UV Express terminal opened. Low-bandwidth, form-based, no GPS required.
2. **Geotraced trips** — a rider opts in to record their phone's location for the duration of one commute. This is how new route *geometry* gets built (map-matched afterward, per Theme 2 of the roadmap), not just corrections to existing geometry.

These need different UX, different validation, and different privacy handling — a single "submit data" form conflates two very different trust/risk profiles.

## Architecture: fits the existing three-layer model, doesn't invent a new one

Reuses `docs/DATA_ENGINEERING_ROADMAP.md` Theme 6's Bronze/Silver/Gold layering:

- **Bronze (raw):** every submission lands here unmodified — raw GPS ping stream or raw correction-form payload, plus ingestion metadata (pseudonymous contributor id, submission timestamp, app version, device accuracy). Immutable, append-only. Never used directly for routing.
- **Silver (canonical):** promoted only after validation. For traces: map-matched (FMM/Valhalla, per Theme 2), deduplicated, checked against Theme 5's data-quality dimensions. For corrections: reviewed against the current canonical route.
- **Gold (serving):** the actual routing graph `build_transit_graph` consumes today — unchanged by this feature, it just gets better-fed inputs over time.

## The trust problem: redundancy over moderation-by-committee

Transport for Cairo's lesson (already captured in Theme 8): **have every trip mapped more than once.** A single anonymous submission should never silently become "truth" — that's how bad data poisons the graph. Concretely:

- A route/stop only gets promoted Bronze → Silver once **N independent contributors** (not N submissions from the same device/session) agree within a distance/time tolerance. This mirrors the existing `approved_routes` table's `trip_count`/`rating_sum` pattern already in `backend/main.py`'s schema — that table is evidence this "accumulate confidence over repeated independent signals" pattern is already a comfortable idiom in this codebase, not a new concept to introduce.
- A single trusted-editor override path (manual review) exists for obvious corrections (e.g. a fare change everyone already knows about) so the system isn't purely mechanical, but the *default* path is redundancy-based, not "first submission wins."

## Privacy — this is a hard gate, not a checklist item

Everything in `docs/DATA_ENGINEERING_ROADMAP.md` Theme 7 applies directly and must be resolved **before** any geotrace-capture endpoint ships, not after:

- Explicit, specific, time-bound, withdrawable consent *before* first trace capture (RA 10173 IRR §19) — cannot be bundled into general app terms.
- Pseudonymous device/session id, never tied to an account key for trace storage.
- Truncate the first/last ~100–200m of every trace before it leaves Bronze, to avoid revealing home/work addresses.
- A published retention schedule; delete or fully anonymize raw traces once speeds are derived.
- Data-subject access/erasure mechanism.
- A Privacy Impact Assessment before this ships, and NPC registration if PARA crosses the ≥1,000-data-subject threshold (very likely for an open community feature).

Structured corrections (no GPS) carry much lower privacy risk and could ship well ahead of geotracing — this is a reason to sequence Phase 1 (corrections) before Phase 2 (traces), not just a technical convenience.

## Proposed phasing (none of this is built yet)

**Phase 1 — Structured corrections only (lowest risk, fastest to ship):**
- A simple form (web + in-app): route/stop/fare correction, free-text + optional pin-drop.
- Stored Bronze, reviewed via the redundancy rule above.
- No new privacy gate needed beyond standard account handling already in Supabase.

**Phase 2 — Opt-in geotraced trips:**
- Requires the full RA 10173 gate above closed first.
- Mobile-only (background GPS capture during a declared trip), ~1 Hz sampling per Theme 2's guidance.
- Map-matched offline/batch via FMM (Theme 2's recommendation), not in the request path.
- This is the concrete mechanism for eventually filling the UV Express/provincial-bus gap.

**Phase 3 — Public/open-source data exposure:**
- Publish the canonical (Silver) schema as downloadable GTFS-vocabulary exports (mirrors Sakay.ph's practice of publishing GTFS on GitHub, per Theme 8 — "government hosting disappears," so PARA should own its own distribution).
- Attribution/leaderboard for contributors, if desired for advocacy — deliberately last, since gamification incentives can bias what gets submitted (a known risk NPC scrutinizes for consent-related rewards, per Theme 7).

## Explicitly out of scope for this doc

- Exact schema/migration DDL, endpoint signatures, and moderation UI — that's implementation, to be scoped when Phase 1 is greenlit.
- ML-based automatic trace validation — Theme 4's "defer ML" guidance applies here too; redundancy-based validation is the right starting point.

## Open questions for the next planning session

1. Who are the "trusted editors" for the manual-override path, and what's their review workload realistically going to be?
2. What's the minimum N for redundancy-based promotion (Transport for Cairo didn't publish a specific number) — needs a judgment call calibrated to PARA's expected contributor volume.
3. Does Phase 1 (corrections) get its own lightweight moderation UI, or does it initially route through an existing admin/support surface?
