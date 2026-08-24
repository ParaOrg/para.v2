# Para PH ML Pipeline

## Data Flow
Frontend (GPS + Forms)
│
├── Supabase Tables
│ ├── ph_user_tracks (GPS traces, segments)
│ ├── fare_reports (fare data)
│ └── ph_places (POIs)
│
├── ML Training (ml-train Edge Function)
│ ├── Computes: avg_speed, reliability_score, wait_times
│ └── Writes: route_ml_stats table
│
└── Graph Enhancement (graph_engine.py)
├── Reads: route_ml_stats
├── Adjusts: edge weights by reliability
└── Output: ML-enhanced routing graph

text

## Components

1. **route_ml_stats table** - Trained features per route
2. **ml-train Edge Function** - Computes features from raw data
3. **ml-scheduled Edge Function** - Triggers training when enough data
4. **graph_ml_integration.py** - Applies ML features to routing graph
5. **train_ml_features.py** - Standalone training script (for cron/CI)

## Scheduling

- Run `ml-scheduled` every 30 minutes via pg_cron or external scheduler
- Or run `train_ml_features.py` as a nightly cron job

## ML Features

| Feature | Description | Used For |
|---------|-------------|----------|
| avg_speed_kmh | Average speed per route | ETA prediction |
| std_dev_speed | Speed variability | Reliability scoring |
| avg_wait_time_min | Average wait time | Transfer planning |
| reliability_score | 0-1 score | Edge weight adjustment |
| avg_fare | Average fare | Cost-based routing |
| total_trips | Trip count | Confidence scoring |
