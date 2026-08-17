#!/bin/bash
# Clear Python cache before build
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null
pip install -r requirements.txt
