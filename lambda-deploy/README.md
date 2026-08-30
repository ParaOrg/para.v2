# Para PH Lambda Deployment Package

## Files
- `lambda_function.py` - Main routing engine
- `graph_full_rail.json.gz` - Transit graph with rail continuity

## Deployment Steps
1. Zip these files: `zip -r para-route-search.zip lambda_function.py graph_full_rail.json.gz`
2. Upload to AWS Lambda function `para-route-search`
3. Set environment variables:
   - SUPABASE_URL=https://tcvomrkytxnetzijwqad.supabase.co
   - SUPABASE_SERVICE_KEY=<service-role-key>

## Graph Update
To update the graph:
1. Run `python3 scripts/build_rail_graph.py`
2. Copy new `graph_full_rail.json.gz` to this directory
3. Re-deploy
