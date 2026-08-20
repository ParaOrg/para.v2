#!/bin/bash

echo "=== How frontend fetches route reference ==="
grep -n "ph_route_reference\|reference\|route_name\|mode" src/pages/ContributePage.tsx | head -30

echo -e "\n\n=== Check useContributeSync for route selection ==="
grep -n "route_name\|reference\|mode\|fetch" src/hooks/useContributeSync.ts | head -30

echo -e "\n\n=== Check LiveRouteRecorder for route selection ==="
grep -n "route_name\|reference\|mode\|fetch\|select" src/components/LiveRouteRecorder.jsx | head -30

echo -e "\n\n=== Check if there's a route dropdown/selector ==="
find src -type f -exec grep -l "route.*select\|select.*route\|dropdown.*route" {} \; 2>/dev/null | head -10

echo -e "\n\n=== Check API endpoint for reference routes ==="
grep -n "reference\|route_reference" api_routes.py v1_routes.py admin_routes.py 2>/dev/null
