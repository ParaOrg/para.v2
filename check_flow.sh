#!/bin/bash

echo "=== Checking Project Structure ==="
find . -maxdepth 2 -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.sql" -o -name "*.json" -o -name "*.env" \) | head -50

echo -e "\n=== Checking for Database Files ==="
find . -maxdepth 3 -type f \( -name "*.db" -o -name "*.sqlite" -o -name "*.sql" \) | head -20

echo -e "\n=== Checking for Supabase/Firebase Config ==="
find . -maxdepth 2 -type f \( -name ".env*" -o -name "supabase*" -o -name "firebase*" -o -name "config*" \) | head -20

echo -e "\n=== Checking Package Files ==="
find . -maxdepth 2 -type f -name "package.json" -exec echo "Found: {}" \;
find . -maxdepth 2 -type f -name "requirements.txt" -exec echo "Found: {}" \;
find . -maxdepth 2 -type f -name "pyproject.toml" -exec echo "Found: {}" \;

echo -e "\n=== Checking Main App Files ==="
find . -maxdepth 2 -type f \( -name "app.py" -o -name "main.py" -o -name "server.py" -o -name "index.js" -o -name "app.js" \) | head -10

echo -e "\n=== Checking for Tracker Related Files ==="
find . -maxdepth 3 -type f \( -name "*track*" -o -name "*route*" -o -name "*gps*" \) | head -20

echo -e "\n=== Current Directory ==="
pwd
ls -la | head -30
