# PARA (para.v2): Algorithms & Data-Engineering Roadmap for Reliable Jeepney Multimodal Routing

> Reference document for engineering work on para.v2. See `CLAUDE.md` for how this is used in this repo.

## TL;DR
- **Adopt a GTFS-vocabulary canonical schema now, migrate to PostGIS, and use GTFS-Flex to model jeepney route deviation** — the existing 9-phase roadmap is fundamentally sound and matches how Digital Matatus, Transport for Cairo, and Sakay.ph actually built informal-transit data; the highest-leverage near-term work is data-model and pipeline discipline, not fancy ML.
- **Use FMM (Fast Map Matching) or Valhalla Meili off-the-shelf for map-matching, and true Yen's k-shortest-paths only with a penalty/plateau pre-filter** — you do not need to hand-build an HMM, and pure Yen's is too slow on a 75K-node graph without pruning.
- **Defer ML ETA prediction well beyond Phase 8**: peer-reviewed transit studies show simple time-bucketed historical averages beat ML on short trips and that data volume past ~10–30 days barely helps; gradient-boosted trees deliver only single-digit-percent MAE gains even at Uber's global scale, so empirical speeds are the right target for PARA.

## Key Findings

1. **The roadmap is well-aligned with real-world informal-transit practice.** Every comparable project — Digital Matatus (Nairobi), Transport for Cairo, Sakay.ph (Manila), AccraMobile3 — converged on the same pattern: collect GPS traces with smartphones, map-match/clean them, and encode into a GTFS-derived schema with *frequencies* rather than fixed timetables. PARA's phased plan mirrors this.
2. **Jeepneys are a "frequency-based, flag-down" service** — roughly 250,000 jeepney units operate nationwide with about 55,000 plying some 900 routes in Metro Manila (DOTr & GIZ, 2016), carrying on the order of 9 million commuter trips a day. Spiess & Florian's optimal-strategies model is the correct theoretical backbone, but it must be adapted (headway/frequency inputs, no fixed stops). GTFS-Flex (adopted into GTFS March 2024) is the standards-based way to represent route deviation and zone pickup.
3. **Map-matching does not require historical data to bootstrap** — HMM map-matching (Newson & Krumm) is geometric/topological, not learned, so it works cold-start. Mature open-source engines (FMM, Valhalla Meili, GraphHopper, OSRM) already implement it.
4. **True k-shortest-paths is feasible but needs pruning.** Yen's algorithm is exact but expensive; penalty and plateau methods are faster and produce more "reasonable" alternatives in practice on road networks.
5. **ML ETA is low-ROI at PARA's scale.** Evidence strongly suggests empirical time-bucketed speeds capture most of the achievable accuracy; ML adds only marginal gains and demands infrastructure PARA doesn't have.
6. **Privacy compliance (RA 10173) is a genuine legal gap** that must be closed *before* the GPS ingestion endpoint ships, not after.

## Details

### Theme 1 — Frequency-based assignment for informal/paratransit systems

The canonical model is **Spiess & Florian (1989), "Optimal strategies: A new assignment model for transit networks," *Transportation Research Part B* 23(2):83–102** — passengers choose a *strategy* (a set of attractive lines) rather than a single path, and expected wait = 1/(sum of frequencies of attractive lines). This is the right backbone for jeepneys precisely because they have no timetable — a rider boards "whatever comes first among acceptable jeepneys."

Beyond Spiess & Florian, relevant extensions and alternatives:
- **De Cea & Fernández (1993)** section-based transit assignment, which uses a route-section network representation and is compared head-to-head with Spiess-Florian in the transit-network-design literature. Both are reviewed as the two foundational graphical frequency-based models.
- **Frequency-based assignment with online information** (Oliker & Bekhor, *EURO Journal on Transportation and Logistics* 9(1):100005, 2020) — relevant if PARA ever adds live vehicle tracking (as Sakay.ph's tracker does).
- **Schmöcker et al. (2011)**, frequency-based assignment with seat/capacity constraints (*Transportation Research Part B* 45:392–408) — relevant to overcrowded Manila jeepneys.
- **Two-step Transit Network Frequency Setting Problem (TNFSP)** applied to Visakhapatnam, India (a city with ~9% paratransit / 18% formal transit share) — a recent framework that does headway-based multimodal assignment *integrating* paratransit with formal transit, the closest published analogue to PARA's multimodal jeepney+LRT/MRT problem.

**Real-world informal-transit modeling:** Digital Matatus explicitly created a "more flexible GTFS standard" for Nairobi and, lacking `stop_times.txt` schedule data, "used frequencies of trips from the main terminus (at and off-peak hours)" — i.e., they populated GTFS `frequencies.txt` instead of fixed schedules. This is the single most directly transferable precedent for PARA. The same frequency-based approach appears in Accra (AccraMobile3), Bamako (Sotrama), Cairo (Transport for Cairo), and the World Bank/DigitalTransport4Africa methodology.

**Recommendation:** Model jeepney legs with a Spiess-Florian-style strategy/common-lines cost (wait = ½ × headway, boarding penalty, in-vehicle time from empirical speeds), and store headways in a GTFS `frequencies.txt`-style table by time bucket. This is more faithful than PARA's current fixed-edge-weight Dijkstra and directly supports the "which jeepney to take" question.

### Theme 2 — Cold-start HMM map-matching

Newson & Krumm (2009), "Hidden Markov Map Matching Through Noise and Sparseness" (ACM SIGSPATIAL) is a **model-based, not data-trained** algorithm: emission probabilities come from a Gaussian on GPS-to-segment distance, transition probabilities from the difference between great-circle and on-road distance. It needs **no historical training corpus** — so PARA's zero-trace situation is *not* a blocker. The paper's own ground-truth test used a single 7,531-point trace (~80 km at 1 Hz); accuracy stays high down to ~30 s sampling intervals and degrades sharply beyond that.

**Practical cold-start strategy for a small team:**
- **Do not hand-implement the HMM.** Use a mature engine:
  - **FMM (Fast Map Matching)** — open-source C++/Python, integrates HMM with a precomputed upper-bounded origin-destination table (UBODT); reports **25,000–45,000 points/second single-threaded** (5–6× with OpenMP parallelism), scales to millions of points and edges, reads OSM/shapefile. Best fit for batch map-matching PARA's accumulating traces cheaply.
  - **Valhalla Meili** — production HTTP service, Dockerized (gis-ops image), uses OSM; good if PARA wants a service rather than a library.
  - **GraphHopper map-matching** and **OSRM `match` service** — both Newson-Krumm-based; OSRM `match` is easiest for quick research use.
  - **bmwcarit/offline-map-matching** — a minimal library if PARA wants to plug in its own NetworkX graph.
- **Tune for Metro Manila urban canyons:** increase Meili/FMM `search_radius`, `sigma_z` (GPS noise), and `beta` (transition weight) because multipath error in dense areas is worse than the ~5–10 m open-sky figure. The current 5-decimal (~1.1 m) coordinate snap is indeed far too tight; a 15–25 m matching radius is more realistic.
- **Sampling:** capture at ~1 Hz where battery allows; matching quality is usable immediately per-trace (no minimum corpus), but you need enough *distinct* traces per route to build reliable speed statistics (see Theme 4).

### Theme 3 — k-shortest-paths / alternative routes

PARA's current "penalize primary edges 3× and re-run Dijkstra" is actually a crude **penalty method** — a legitimate, widely-used family, not merely a hack, but undisciplined. Options:

| Method | Pros | Cons | Fit for PARA |
|---|---|---|---|
| **Yen's algorithm** | Exact k-shortest *loopless* simple paths; in NetworkX via `shortest_simple_paths` | Repeated Dijkstra; expensive on 75K nodes for interactive latency; paths often near-duplicates | Use for offline/precomputed or small subgraphs |
| **Penalty method** | Simple, already partially built; produces genuinely different routes because road nets have many near-equal paths; can post-filter for dissimilarity | No guarantee of optimality or diversity; needs tuning | **Primary near-term choice**, formalized |
| **Plateau / via-node** | Fast; finds intuitive "branch then rejoin" alternatives used by commercial engines | A plateau alternative is essentially one via-node, limiting diversity; can hide detours | Good complement for "1 good alternative" |
| **Dissimilarity / disjoint paths** | Guarantees distinct routes | Edge-disjoint can produce very bad results if a bottleneck edge is shared | Avoid as sole method |

**Recommendation:** Keep a **penalty method as the workhorse but add an explicit dissimilarity filter** (reject candidates sharing >X% of edges/length with accepted ones), and consider a **plateau/via-node pass** to surface one clearly-distinct alternative. Reserve **Yen's (via `networkx.shortest_simple_paths`)** for offline generation or after graph contraction, since exact k-SP on a 75K-node graph is too slow for per-request interactive use without pruning. Academic user studies (Melbourne/Dhaka/Copenhagen road networks) confirm penalty and plateau "perform remarkably well right out of the box."

### Theme 4 — Empirical speeds vs ML ETA: where's the threshold?

The evidence is decisive that **PARA should invest in empirical time-bucketed speeds and treat ML as a distant, conditional Phase 8+**:

- **Uber's own numbers set the ceiling on ML's value.** In "DeeprETA: An ETA Post-processing System at Scale" (Hu, Binaykiya, Frank & Cirit, arXiv:2206.02127, 2022), the deep model (DeeprETANet) achieved a **7.83% relative MAE improvement over the raw routing engine**, versus **5.07% for the XGBoost baseline** — i.e., deep learning beat gradient-boosted trees by only ~2.76 percentage points. In production A/B tests DeeprETA beat the in-production XGBoost by **2.91% (delivery) and 2.66% (rides) MAE**. These are single-digit gains at *global* scale, with the model trained on roughly **1.4 billion ETA requests** over 14 days. Uber notes even low-single-digit error reductions "unlocks tens of millions of dollars per year" — an economic case PARA does not have. (Note: the paper reports only *relative* improvements over its routing engine, never absolute seconds, and benchmarks against XGBoost/ResNet/HammockNet, not a pure historical average.)
- **For fixed-route transit, historical averages often *beat* ML on short trips.** Pałys, Ganzha & Paprzycki, "Machine Learning for Bus Travel Prediction" (ICCS 2022, LNCS 13351:703–710) used 30 days of Warsaw bus GPS (>1M training records) and found the best MLP had MAE ≈101.6 s while the **Historical Average baseline achieved 35–72 s MAE** across route groups — HA won on short-distance predictions. Their verbatim conclusion: "for short-distance predictions, for all groups, the HA algorithm combined with distribution times, delivered better accuracy than the hybrid model."
- **Data volume past ~10 days barely helps.** Kormáksson et al. (IBM Research, "Bus Travel Time Predictions Using Additive Models," arXiv:1411.7973 / IEEE ICDM 2014), using Rio de Janeiro data (>100M GPS entries, >400 routes), tested 10/20/30-day training windows and found "the size of the training data does not seem to affect performance of any of the 5 methods." Model *structure* (additive mixed models) mattered more than data quantity; their additive models hit adjusted R²=0.90–0.97. Where ML did help, the additive model cut mean absolute relative error to ~13–19% vs ~17–24% for kernel-regression historical averaging.

**Practical threshold for PARA:** There is no universal "N trips" cutoff, but the literature implies you need at least **~10–30 days of map-matched traces per route-segment per time bucket** before *any* model stabilizes, and that at that point **time-bucketed empirical averages are competitive with ML**. Only build gradient-boosted trees (LightGBM/XGBoost/CatBoost — best-in-class for tabular data) if, after Phase 7, residual error on your benchmark suite is both large *and* structured (e.g., systematic peak-hour/weather effects the buckets miss). Deep learning is not justified at a regional commuter-app scale.

### Theme 5 — Operationalizing DAMA-DMBOK's six data-quality dimensions

The six dimensions (accuracy, completeness, consistency, timeliness, validity, uniqueness) come from the DAMA UK working group and DAMA-DMBOK 2nd ed. (2017). Concrete checks for PARA:

| Dimension | Graph (routes/stops/edges) | GPS trace pipeline |
|---|---|---|
| **Accuracy** | Edge geometry within X m of OSM/satellite ground truth; empirical speeds within tolerance of benchmark trips | Map-matched point-to-road residual (Meili/FMM offset) below threshold |
| **Completeness** | No route missing geometry; % of LTFRB franchised routes represented (in Manila, students mapped >900 jeepney routes vs ~500 officially recognized by LTFRB — expect official undercounts) | % of trips with ≥N points; no large temporal gaps |
| **Consistency** | WGS84 everywhere; ISO-8601 timestamps; edge-node referential integrity (every edge's endpoints exist) | Units/CRS identical to graph; speeds physically plausible (0–60 km/h) |
| **Timeliness** | Graph rebuild freshness (route changes integrated within target window — Sakay.ph needs ~1 month) | Ingestion latency; trace age monitoring |
| **Validity** | Coordinates within Metro Manila bbox; enum fields (mode, direction) in allowed set; schema conformance | Accuracy/heading fields within range; monotonic timestamps |
| **Uniqueness** | No duplicate stops within X m; no duplicate edges | Deduplicate repeated pings; dedupe re-uploaded traces |

Compute each as a % score at layer boundaries (see Theme 6), alert on drops, and log for the observability requirement already in the plan.

### Theme 6 — Schema-first canonical model + three-layer architecture

**Adopt a GTFS-vocabulary internal schema** (routes, stops, trips, shapes, stop_times/frequencies) even though jeepneys break GTFS's fixed-schedule assumption — because it (a) is the lingua franca every comparable project used, (b) makes a future swap to official LTFRB/DOTr feeds or LRT/MRT/PNR GTFS an *adapter* change rather than a re-architecture, and (c) unlocks the MobilityData validator and OpenTripPlanner (which Narboneta & Teknomo, 2015, used for exactly this Metro Manila multimodal problem).

**Use GTFS-Flex** — officially adopted into the GTFS spec in March 2024 with 18 votes in favour ("the most votes in GTFS history," per MobilityData; Transit App and OpenTripPlanner were the first two consumers, Trillium the first producer) — for jeepney route-deviation and zone pickup/drop-off: it adds `locations.geojson` polygon zones, `booking_rules.txt`, and pickup/drop-off windows, and represents "continuous pickup/drop-off" along a segment — a near-exact match for flag-down jeepney behavior.

**Three-layer (medallion / raw→canonical→serving) architecture:**
- **Raw (Bronze):** GPS pings and QGIS/GeoJSON exports exactly as received + ingestion metadata (source, batch id, timestamp). Immutable audit trail.
- **Canonical (Silver):** cleaned, map-matched, deduplicated, schema-standardized GTFS-vocabulary tables; data-quality gates enforced here.
- **Serving (Gold):** the routing graph (nodes/edges with time-bucketed speeds and headways) optimized for Dijkstra/assignment queries.

**Frameworks worth adopting even at small scale:**
- **MobilityData Canonical GTFS Schedule Validator** — free, open-source, desktop app (no coding needed), used by Google Maps/Transit/Moovit; run it on every canonical build.
- **Great Expectations** for raw→canonical validation checkpoints; **dbt tests** for structural/relational checks if/when PARA moves to a SQL warehouse; **Soda** for ongoing monitoring. Start with just dbt-style tests + GE on the critical tables — the medallion pattern's own guidance warns small fast-moving teams against over-engineering layers.
- Keep graph builds **reproducible** (pinned inputs, scripted, CI-run) — a stated observability goal.

### Theme 7 — GPS ingestion architecture + RA 10173 compliance

**Storage:** Migrate off prototype SQLite. The best-fit low-cost stack is **PostgreSQL + PostGIS + TimescaleDB**: PostGIS gives `GEOGRAPHY(Point,4326)` types, GIST spatial indexes, and `ST_DWithin` proximity queries; TimescaleDB adds hypertable time-partitioning for high-volume append-only pings. This single database serves both the trace pipeline and the graph, avoids a separate time-series system, and is free/self-hostable. Cheaper interim option: partitioned PostgreSQL+PostGIS without Timescale until ping volume justifies it. Store raw traces append-only; keep map-matched results in the canonical layer.

**RA 10173 (Data Privacy Act of 2012) compliance — must be addressed before the ingestion endpoint ships.** GPS location trails are personal information (identity "reasonably and directly ascertained" when combined with other data), so under the Act and its IRR (in force since 2016, enforced by the National Privacy Commission):
- **Lawful basis / consent:** Consent must be "freely given, specific, informed," evidenced by written/electronic/recorded means, time-bound, and withdrawable (IRR §19). Present a clear in-app consent flow *before* first trace capture; do not bundle it into unrelated terms. NPC scrutinizes consent induced by rewards.
- **Proportionality & purpose limitation:** Collect only what routing needs; declare the specific purpose (improving jeepney travel-time data).
- **Anonymization/pseudonymization:** Strip direct identifiers; store traces under a rotating pseudonymous device/session id, not a user account key. Truncate/blur trip origins and destinations (drop the first/last ~100–200 m) to avoid revealing home/work — a standard technique and directly responsive to the re-identification risk of endpoints.
- **Retention limits:** Define and document a retention schedule (IRR requires it); retain raw traces only as long as needed to derive speeds, then delete or fully anonymize.
- **Data-subject rights:** Provide mechanisms for access, correction, erasure/withdrawal, and objection.
- **Security & governance:** Reasonable organizational/physical/technical safeguards (§20), a Privacy Impact Assessment before launch, a Privacy Management Program, appoint a Data Protection Officer, and a 72-hour breach-notification capability. Registration with the NPC is required if the system processes sensitive data or the data of ≥1,000 individuals. Note NPC Advisory 2024-04 extends DPA duties to AI systems — relevant if PARA later trains ML on traces. Penalties are severe: under **NPC Circular No. 2022-01 (issued 12 Aug 2022, effective 27 Aug 2022)**, grave infractions are fined 0.5%–3% of annual gross income and major infractions 0.25%–2%, with "the total imposable fine for a single act… [not to] exceed Five Million Pesos (PHP5,000,000.00)"; criminal provisions add imprisonment.

### Theme 8 — Case studies and transferable lessons

- **Sakay.ph (the most direct analogue):** built on the AusAID/World Bank-funded Philippine Transit Information Service GTFS dataset (>900 routes) from the 2013 Transit App Challenge; uses OpenTripPlanner-style multimodal routing over GTFS+OSM. Hard-won lessons from the Sakay team (2025 interview): transport data is *expensive to maintain*, they need **~1 month to process/verify new data**, they publish GTFS on GitHub because government hosting disappears, and a well-funded competitor (WhereIsMyTransport) ceased operations in October 2023 after raising over US$27M since 2016 — its founder Devin de Vries posting "Having failed to raise our round, we've stopped operations." **Lesson: PARA's sustainability risk is data maintenance, not algorithms.**
- **Digital Matatus (Nairobi):** ~10 University of Nairobi students, smartphones, ~4 months → recorded almost 3,000 stops on more than 130 routes (the final map is often cited as 135 routes, first incorporated into Google Maps in August 2015; roughly 3.5 million people depend on matatus daily). It invented the frequency-based flexible-GTFS approach. **Lesson: a small student team *can* produce authoritative data; redundant mapping + local expert workshops are the QA method.**
- **Transport for Cairo (World Bank, 2019):** 19 field researchers; **each trip mapped more than once** so redundancy validates itineraries and flags deviating routes for re-mapping; automated GPS-trace→GTFS pipeline. **Lesson: multiple independent traces per route is the practical ground-truth/validation mechanism** — directly applicable to PARA's benchmark suite (Theme 9).
- **Narboneta & Teknomo (2015, UP):** built a Metro Manila multimodal planner with OpenTripPlanner over LTFRB GTFS + OSM, but noted some route suggestions "are not the actual routes used by commuters" — **a direct warning that official/derived route geometry must be validated against real traces.**
- **World Bank / DigitalTransport4Africa / GIZ:** produced a reusable 7-module training program and methodology for GTFS creation in resource-constrained cities; JungleBus + OSM used for Accra/Abidjan/Bamako. **Lesson: OSM is a viable canonical geometry store and community-validation layer** (the OSM wiki already documents Metro Manila jeepney/UV-Express route mapping conventions, e.g., stop spacing 200 m busy / 400 m residential).

### Theme 9 — Automated graph validation + ground-truth benchmarking

No automated testing exists today; this is the highest-risk gap after privacy. Recommended layered approach:

- **Structural/topology tests (run every graph build, in CI):**
  - **Strongly-connected-components analysis** via Tarjan's/Kosaraju's algorithm (O(V+E)) — a routable graph should be (nearly) one giant SCC; large numbers of small SCCs signal disconnected/one-way errors. This is exactly the technique used in commercial map-error-correction (patented SCC-class connectivity checks) and academic OSM-graph reconstruction.
  - **Referential integrity:** every edge's endpoints exist; no orphan nodes; no zero-length or duplicate edges.
  - **Connectivity gap-filling checks:** flag terminal nodes suspiciously close to other segments (a known OSM artifact).
  - **Load/route smoke test:** assert the graph loads and a sample of O-D pairs routes successfully (the method used in the OSMnx "street networks for every US city" validation).
- **Semantic validation:** run the **MobilityData Canonical GTFS Schedule Validator** on every canonical build (foreign-key, range, and best-practice checks); note it can catch *form* errors but not whether a route is *factually* correct — that requires ground truth.
- **Ground-truth benchmark suite (Phase 4):** assemble a fixed set of real commuter O-D trips with **multiple independently-collected GPS traces each** (the Transport for Cairo redundancy method). Compare PARA's predicted route geometry and travel time against these; track MAE/MAPE of ETA and route-overlap (% shared edges) as regression metrics. Report per-time-bucket so peak-hour degradation is visible. This suite is also what tells you (Theme 4) whether ML is ever justified.
- **Continuous monitoring:** freshness metrics per route, drift detection on empirical speeds vs benchmark, and data-quality-dimension scores (Theme 5) surfaced on a dashboard.

## Recommendations (staged)

**Stage A — Foundations (Phases 0–2), do first, in order:**
1. **Close the RA 10173 gap before shipping the GPS endpoint:** consent flow, pseudonymization, endpoint truncation, retention schedule, PIA, DPO. This is a legal precondition, not a "nice to have."
2. **Migrate SQLite → PostgreSQL + PostGIS** (add TimescaleDB when ping volume warrants). Introduce migrations/ORM.
3. **Stand up the raw→canonical→serving layering** with a GTFS-vocabulary canonical schema and GTFS-Flex fields for jeepney deviation. Add dbt-style + Great Expectations checks and wire the MobilityData validator into CI.
4. **Add Phase-0 structural graph tests** (SCC count, referential integrity, load/route smoke test) to CI immediately — cheap, high-value.

**Stage B — Correct routing (Phases 5–6):**
5. Replace the ad-hoc 3× penalty with a **formalized penalty method + dissimilarity filter**, add a plateau/via-node alternative, and keep Yen's (`networkx.shortest_simple_paths`) for offline use.
6. Model jeepney legs with a **Spiess-Florian frequency/strategy cost** and store headways by time bucket.
7. Adopt **FMM** (batch) or **Valhalla Meili** (service) for map-matching; tune radius/sigma for Manila urban canyons; loosen the 1.1 m snap to ~15–25 m.

**Stage C — Empirical accuracy (Phase 7), then conditionally ML (Phase 8):**
8. Build **time-bucketed empirical speeds** from map-matched traces once you have ~10–30 days per segment/bucket.
9. Build the **ground-truth benchmark suite** (multiple traces per O-D) and measure ETA MAE/MAPE + route overlap.
10. **Only if** post-Phase-7 residual error is large and structured, pilot **LightGBM/XGBoost** ETA post-processing; do not pursue deep learning.

**Benchmarks/thresholds that change the plan:**
- If benchmark ETA MAPE is already <~15% with empirical speeds → **do not build ML.**
- If a route has <~10 days of traces per bucket → **keep empirical averages / defaults**, don't model.
- If graph SCC analysis shows >1 significant component → **block release** until connectivity fixed.
- If data-freshness exceeds your target window (Sakay's benchmark is ~1 month) → prioritize pipeline automation over features.

## Caveats
- **ML-ETA evidence is context-dependent and partly contested.** Uber's DeeprETA reports only *relative* improvements over its routing engine (never absolute seconds) and compares against XGBoost, not a pure historical average; it is a ride-hail/delivery system, not fixed-route transit. Some transit studies (e.g., Serin et al. 2022, MAPE ≈2.55%) report large ML gains, while others (ICCS 2022) find historical averages win — results hinge on trip length, city, and features. Treat the "defer ML" recommendation as well-supported for PARA's scale but revisit with your own benchmark data.
- **Jeepney-specific route-choice/travel-time literature is thin.** Most Philippine jeepney research is on delay microsimulation (Palmiano et al. 2004), mode choice, or service quality — not routing-graph travel-time modeling. PARA will be partly building precedent, so the benchmark suite is essential.
- **GTFS-Flex is young** (adopted 2024); consumer support beyond OpenTripPlanner/Transit is still maturing, and Google Maps currently integrates only its continuous-stops feature. Use it as an internal modeling vocabulary regardless.
- **Some quantitative thresholds are necessarily fuzzy.** No source gives a universal "N trips" ML-crossover point; the ~10–30-day figure is inferred from a small number of bus studies (Rio, Warsaw) and may differ for Manila jeepneys.
- **Source-quality note:** engineering-blog and secondary summaries (Medium, vendor blogs) were used for orientation but primary sources (arXiv papers, ACM/journal articles, official gtfs.org/MobilityData/NPC documentation) underpin every substantive claim above. A few figures (e.g., NPC administrative-fine ceilings, exact validator behavior, the 250,000/55,000 jeepney counts) come from secondary or agency-cited summaries and should be confirmed against the primary NPC circulars and DOTr/GIZ reports before relying on them operationally.
