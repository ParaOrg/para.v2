import json
import gzip
import os
import math
import heapq
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 1. FOOLPROOF PATH RESOLUTION (Fixes the Errno 2)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_PATH = os.path.join(BASE_DIR, 'graph_full.json.gz')

# 2. GLOBAL STATE FOR WARM STARTS
_graph = None
_nodes = None

def load_graph():
    global _graph, _nodes
    if _graph is not None and _nodes is not None:
        return _graph, _nodes
    
    if not os.path.exists(GRAPH_PATH):
        raise FileNotFoundError(f"Graph not found at {GRAPH_PATH}. Dir contents: {os.listdir(BASE_DIR)}")
        
    with gzip.open(GRAPH_PATH, 'rt') as f:
        data = json.load(f)
        
    _graph = data.get('adj', {})
    _nodes = data.get('nodes', {})
    logger.info(f"✅ Graph loaded: {len(_graph)} nodes")
    return _graph, _nodes

# Pre-load graph during INIT phase (Cold Start)
try:
    load_graph()
except Exception as e:
    logger.error(f"❌ CRITICAL INIT ERROR: {e}")

def cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }

def lambda_handler(event, context):
    # Handle CORS Preflight
    if isinstance(event, dict) and event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    try:
        # Ensure graph is loaded
        adj, nodes = load_graph()
        
        # Parse Event (Handle Function URL, API Gateway, and Direct Invoke)
        body = {}
        if isinstance(event, dict):
            if 'body' in event and event['body']:
                body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
            else:
                body = event
                
        message = body.get('message', '')
        user_loc = body.get('user_location', {})
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
                'status': 'success',
                'message': 'Lambda is alive and graph is loaded!',
                'nodes_loaded': len(adj),
                'graph_path_used': GRAPH_PATH
            })
        }
        
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({'status': 'error', 'message': str(e)})
        }
