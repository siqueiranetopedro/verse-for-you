#!/bin/bash
# Verse for You — GitHub Setup Script
# Run this once from Terminal to create the GitHub repo and push all code

TOKEN=""  # token removed for security
USERNAME="siqueiranetopedro"
REPO="verse-for-you"

echo ""
echo "╔════════════════════════════════════╗"
echo "║   Verse for You — GitHub Setup     ║"
echo "╚════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Step 1: Clean up any broken git state and re-initialize
echo "▶ Setting up git..."
rm -rf .git
git init
git branch -m main
git config user.email "siqueiraneto.pedro@gmail.com"
git config user.name "siqueiranetopedro"

# Step 2: Stage all files
echo "▶ Staging files..."
git add -A

# Step 3: Commit
echo "▶ Creating initial commit..."
git commit -m "Initial commit — Verse for You app"

# Step 4: Create GitHub repo via API
echo "▶ Creating GitHub repository..."
RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO\",\"description\":\"Verse for You — emotion-based Bible verse discovery app\",\"private\":false}")

REPO_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html_url',''))" 2>/dev/null)

if [ -z "$REPO_URL" ]; then
  echo ""
  echo "⚠️  Repo may already exist. Continuing with push..."
  REPO_URL="https://github.com/$USERNAME/$REPO"
fi

echo "✅ Repo: $REPO_URL"

# Step 5: Set remote and push
echo "▶ Pushing code to GitHub..."
git remote remove origin 2>/dev/null
git remote add origin "https://$TOKEN@github.com/$USERNAME/$REPO.git"
git push -u origin main --force

echo ""
echo "✅ Done! Your code is live at:"
echo "   https://github.com/$USERNAME/$REPO"
echo ""
