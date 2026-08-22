#!/bin/bash
# Rebuild Lambda graph from pickle (full graph)

cd ~/para-frontend

python3 << 'PYEOF'
import pickle, json, gzip
from collections import defaultdict

print("🔄 Rebuilding graph from pickle...")

with open('graph_cache.pkl', 'rb') as f:
    G = pickle.load(f)

adj = defaultdict(list)
for u, v, data in G.edges(data=True):
    weight = data.get('weight', 1.0)
    oneway = data.get('oneway', False)
    adj[str(u)].append([str(v), float(weight)])
    if not oneway:
        adj[str(v)].append([str(u), float(weight)])

nodes = {}
for node, data in G.nodes(data=True):
    nodes[str(node)] = [data.get('lat', 0), data.get('lon', 0)]

with gzip.open('lambda-route-search/graph_full.json.gz', 'wt') as f:
    json.dump({'adj': dict(adj), 'nodes': nodes}, f)

total_edges = sum(len(v) for v in adj.values())
print(f"✅ Graph rebuilt: {len(adj)} nodes, {total_edges} edges")

import zipfile
with zipfile.ZipFile('lambda-deploy.zip', 'w') as z:
    z.write('lambda-route-search/lambda_function.py', 'lambda_function.py')
    z.write('lambda-route-search/graph_full.json.gz', 'graph_full.json.gz')
print("✅ Lambda package rebuilt")
PYEOF

aws lambda update-function-code \
  --function-name para-route-search-v2 \
  --zip-file fileb://lambda-deploy.zip

echo "✅ Lambda deployed"
