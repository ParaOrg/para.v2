#!/bin/bash
# Auto-rebuild graph from Supabase and deploy to Lambda
# Run this nightly via cron

echo "🚀 Starting graph rebuild..."

# 1. Run the graph builder
python3 /home/aegis/para-frontend/scripts/build_rail_graph.py

# 2. Replace graph file
cd /home/aegis/para-frontend/lambda-route-search
cp graph_full_rail.json.gz graph_full.json.gz

# 3. Create deployment zip
rm -f ../para-route-search-deploy.zip
zip -j ../para-route-search-deploy.zip lambda_function.py graph_full.json.gz

# 4. Deploy to Lambda
cd /home/aegis/para-frontend
aws lambda update-function-code \
  --function-name para-route-search \
  --zip-file fileb://para-route-search-deploy.zip \
  --region ap-southeast-2

echo "✅ Graph rebuilt and deployed at $(date)"
