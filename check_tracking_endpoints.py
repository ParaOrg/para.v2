#!/usr/bin/env python3

import ast
import os

def extract_function_info(filepath):
    """Extract function definitions and their key logic"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse the AST
        tree = ast.parse(content)
        
        print(f"\n{'='*60}")
        print(f"File: {filepath}")
        print(f"{'='*60}")
        
        # Find all function definitions
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Check if function is related to tracking/routes
                func_name = node.name
                func_keywords = ['track', 'route', 'gps', 'lat', 'lng', 'geo', 'upload', 'save', 'submit']
                
                if any(kw in func_name.lower() for kw in func_keywords):
                    print(f"\n  Function: {func_name}")
                    print(f"    Line: {node.lineno}")
                    
                    # Get decorators (for route endpoints)
                    decorators = []
                    for dec in node.decorator_list:
                        if isinstance(dec, ast.Call):
                            if hasattr(dec.func, 'attr'):
                                decorators.append(dec.func.attr)
                            elif hasattr(dec.func, 'id'):
                                decorators.append(dec.func.id)
                    
                    if decorators:
                        print(f"    Decorators: {', '.join(decorators)}")
                    
                    # Check for SQL/database operations
                    func_source = ast.get_source_segment(content, node)
                    if func_source:
                        if 'INSERT' in func_source or 'insert' in func_source:
                            print(f"    Has INSERT operation")
                        if 'SELECT' in func_source or 'select' in func_source:
                            print(f"    Has SELECT operation")
                        if 'UPDATE' in func_source or 'update' in func_source:
                            print(f"    Has UPDATE operation")
                        if 'supabase' in func_source.lower():
                            print(f"    Uses Supabase")
                        if 'sqlite' in func_source.lower():
                            print(f"    Uses SQLite")
                        if 'geojson' in func_source.lower():
                            print(f"    Uses GeoJSON")
    
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

# Check key files
files_to_check = [
    'api_routes.py',
    'main.py',
    'database.py',
    'fare_routes.py',
    'gas_routes.py',
    'admin_routes.py',
    'backend/api_routes.py',
    'backend/database.py',
]

for filepath in files_to_check:
    if os.path.exists(filepath):
        extract_function_info(filepath)

# Check for route submission patterns
print(f"\n{'='*60}")
print("Checking for route submission patterns...")
print(f"{'='*60}")

patterns = [
    'geojson',
    'ph_routes',
    'ph_route_reference',
    'INSERT INTO',
    'supabase',
    'lat',
    'lng',
    'geocoded',
    'track_count',
    'mapped_by',
]

for pattern in patterns:
    print(f"\n  Pattern: '{pattern}'")
    os.system(f"grep -r '{pattern}' . --include='*.py' --include='*.js' --include='*.ts' -l 2>/dev/null | head -10")
