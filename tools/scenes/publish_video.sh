#!/bin/bash
# Build and incrementally publish https://yahwehs-scenes.netlify.app/video/
# without touching root index.html or existing merged/text-free galleries.
set -e
cd "$(dirname "$0")/../.."
python3 tools/scenes/publish_video.py
cd /Users/pliu0036/Documents/CodingProject/assets-scenes/site-project
SITE_REAL="$(python3 -c 'import os; print(os.path.realpath("site"))')"
PROJECT_REAL="$(dirname "$SITE_REAL")"
cp -R .netlify netlify.toml "$PROJECT_REAL/" 2>/dev/null || true
dot_clean -m "$SITE_REAL/video" 2>/dev/null || true
cd "$PROJECT_REAL"
/Users/pliu0036/Documents/CodingProject/SmartHome/node_modules/.bin/netlify deploy --dir "$SITE_REAL" --site b7f35f48-6a60-4217-a520-21071685afd1 --prod --message "realistic cinema /video/ incremental update" | tail -12
