#!/bin/bash

echo "=== Check database.py ==="
cat database.py

echo -e "\n\n=== Check config.py ==="
cat config.py

echo -e "\n\n=== Check api_routes.py (tracking related) ==="
grep -n "track\|gps\|lat\|lng\|route_name\|ph_route" api_routes.py | head -50

echo -e "\n\n=== Check main.py ==="
cat main.py

echo -e "\n\n=== Check supabase.js ==="
cat supabase.js

echo -e "\n\n=== Check .env.local (without secrets) ==="
grep -v "KEY\|SECRET\|PASSWORD\|TOKEN" .env.local 2>/dev/null || echo "No .env.local or filtered"

echo -e "\n\n=== Check geojson_data files ==="
ls -la geojson_data/

echo -e "\n\n=== Check full_jeepney_routes.csv (first 5 lines) ==="
head -5 geojson_data/full_jeepney_routes.csv 2>/dev/null

echo -e "\n\n=== Check if ph_route_reference exists in code ==="
grep -r "ph_route_reference\|ph_routes" . --include="*.py" --include="*.js" --include="*.ts" --include="*.sql" 2>/dev/null | head -30

echo -e "\n\n=== Check tracking related frontend files ==="
find src -type f -name "*track*" -o -name "*route*" -o -name "*gps*" 2>/dev/null | head -20

echo -e "\n\n=== Check package.json for dependencies ==="
cat package.json

echo -e "\n\n=== Check backend requirements ==="
cat backend/requirements.txt 2>/dev/null || echo "No requirements.txt"
