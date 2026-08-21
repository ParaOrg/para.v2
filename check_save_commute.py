#!/usr/bin/env python3
"""Check exactly where save_commute writes data."""

import re

with open("api_routes.py", "r") as f:
    content = f.read()

# Find save_commute function
match = re.search(r'async def save_commute.*?(?=\n@router|\Z)', content, re.DOTALL)

if match:
    func_code = match.group(0)
    print("save_commute function:")
    print("="*60)
    print(func_code[:2000])
    
    # Check which tables are referenced
    tables_used = re.findall(r'supabase\.table\("([^"]+)"\)', func_code)
    print(f"\nTables used in save_commute:")
    for table in tables_used:
        print(f"   • {table}")
    
    # Check operations
    operations = re.findall(r'\.(insert|update|select|delete|upsert)\(', func_code)
    print(f"\nOperations:")
    for op in operations:
        print(f"   • {op}")
