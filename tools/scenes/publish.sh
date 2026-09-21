#!/bin/bash
# Rebuild the event-picture gallery and publish it to https://yahwehs-scenes.netlify.app (password-gated by the
# edge function in assets-scenes/site-project; the password is in the keychain item "yahwehs-scenes-gallery").
set -e
cd "$(dirname "$0")/../.."
python3 tools/scenes/progress.py --site
cd /Users/pliu0036/Documents/CodingProject/assets-scenes/site-project
/Users/pliu0036/Documents/CodingProject/SmartHome/node_modules/.bin/netlify deploy --dir site --prod --message "scenes gallery" | tail -4
