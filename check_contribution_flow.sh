#!/bin/bash

echo "=== Check ContributePage.tsx (main contribution page) ==="
grep -n "save\|submit\|upload\|track\|gps\|route_name\|ph_route" src/pages/ContributePage.tsx | head -50

echo -e "\n\n=== Check useContributeSync.ts hook ==="
cat src/hooks/useContributeSync.ts

echo -e "\n\n=== Check contributeReducer.ts ==="
head -100 src/reducers/contributeReducer.ts

echo -e "\n\n=== Check LiveRouteRecorder.jsx ==="
grep -n "save\|submit\|upload\|track\|gps\|route_name\|ph_route" src/components/LiveRouteRecorder.jsx | head -30

echo -e "\n\n=== Check InlineRecorder.jsx ==="
grep -n "save\|submit\|upload\|track\|gps\|route_name\|ph_route" src/components/InlineRecorder.jsx | head -30

echo -e "\n\n=== Check api.js for save endpoints ==="
grep -n "save\|submit\|track\|route" src/utils/api.js | head -30

echo -e "\n\n=== Check admin_routes.py save_community_route ==="
sed -n '211,280p' admin_routes.py

echo -e "\n\n=== Check v1_routes.py ==="
cat v1_routes.py

echo -e "\n\n=== Check syncEngine.js ==="
grep -n "save\|submit\|upload\|track\|route" src/utils/syncEngine.js | head -30

echo -e "\n\n=== Check offlineBuffer.js ==="
grep -n "save\|submit\|upload\|track\|route" src/utils/offlineBuffer.js | head -30
