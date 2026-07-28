# Follow-up: Telemetry & Traffic-Aware Routing Port

> Deferred out of the `main` ↔ `SystemsMergedExp` reconciliation (`integrate/main-into-systemsmerged`) on 2026-07-29. Not implemented here — this is a pointer for whoever picks it up next.

## What exists today, unported

On `origin/main` (pre-merge, at commit `8e6d051`), a GPS telemetry / traffic-aware routing prototype was added at the repo root (never migrated into `backend/`):

- `telemetry_engine.py` — GPS ping ingestion (SHA-256 hashed device IDs), congestion-factor calculation per graph edge, `apply_traffic_to_graph()`.
- `api_routes.py` endpoints: `POST /telemetry/ping`, `POST /telemetry/batch`, `GET /traffic/geojson`, `POST /telemetry/simulate`, `POST /traffic/analyze`.
- Two new DB tables (`telemetry_pings`, `traffic_segments`) created in `init_db()`.
- A background congestion-analysis loop (originally `asyncio.create_task` + `sleep(300)` polling — should probably become an `APScheduler` job instead, matching the pattern `backend/gas_price_sync.py` already established in `backend/main.py`'s lifespan).
- `find_routes_with_alternatives()` in `api_routes.py` called `apply_traffic_to_graph()` before pathfinding and appended congestion warnings to route messages — this logic was stripped out during the merge (see `backend/api_routes.py` history around 2026-07-29) since it depended on the unported module.
- `admin_routes.py` (root) also had telemetry-dependent dashboard stats (`/admin/traffic/summary`, `/admin/traffic/segments`, `/admin/telemetry/recent`) — also dropped when `admin_routes.py` was ported into `backend/`.

## Why it was deferred, not ported

Unlike the Admin Dashboard's GIS tools (self-contained, no shared state), this feature touches the same routing core (`find_routes_with_alternatives`) that `SystemsMergedExp` spent real effort testing and hardening (structural graph tests, verified fare/mode data). Porting it in the same pass as the `main` merge would have meant landing untested schema changes and routing-behavior changes on top of an already large reconciliation. Decision made 2026-07-29: land the merge without it, port telemetry separately with its own tests and review.

## What a future port needs

1. Move `telemetry_engine.py` into `backend/`, fix any root-relative path assumptions.
2. Re-add the DB tables to `backend/main.py`'s `init_db()`.
3. Re-add the 5 endpoints to `backend/api_routes.py`, and the 3 admin stats endpoints to `backend/admin_routes.py`.
4. Replace the polling loop with an `APScheduler` job (see `_run_gas_price_sync_safely` / `BackgroundScheduler` in `backend/main.py` for the established pattern).
5. Re-integrate `apply_traffic_to_graph()` into `find_routes_with_alternatives()`, with test coverage this time — none existed before.
6. Frontend: `AdminDashboard.jsx`'s "Traffic" and "Telemetry" tabs are currently unwired placeholders; wire them up once the backend exists.
