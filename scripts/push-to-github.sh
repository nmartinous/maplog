#!/usr/bin/env bash
# Push current branch to GitHub (origin) and trigger a GitHub Pages deploy.
# Run this from the repo root.
set -euo pipefail

echo "Pushing to GitHub..."
git push origin main
echo "Done! GitHub Actions will build and deploy to https://nmartinous.github.io/maplog/ within ~2 minutes."
