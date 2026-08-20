#!/bin/bash

echo "=== Check src directory structure ==="
find src -type f | head -50

echo -e "\n\n=== Check for GPS tracking components ==="
find src -type f \( -name "*GPS*" -o -name "*Track*" -o -name "*Map*" -o -name "*Route*" \) 2>/dev/null

echo -e "\n\n=== Check for API calls related to routes ==="
grep -r "api\|fetch\|axios\|supabase\|track\|gps" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l 2>/dev/null | head -20

echo -e "\n\n=== Check components directory ==="
if [ -d "src/components" ]; then
    ls -la src/components/
fi

echo -e "\n\n=== Check pages directory ==="
if [ -d "src/pages" ]; then
    ls -la src/pages/
fi

echo -e "\n\n=== Check for tracking/contribution page ==="
find src -type f -exec grep -l "contribute\|track\|upload.*route\|record.*route" {} \; 2>/dev/null | head -10
