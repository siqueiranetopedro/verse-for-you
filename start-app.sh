#!/bin/bash
# Verse for You — local dev launcher
cd "$(dirname "$0")"

echo ""
echo "╔════════════════════════════════════╗"
echo "║       Verse for You — Dev          ║"
echo "╚════════════════════════════════════╝"
echo ""

# Load .env file if it exists
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
  echo "✅ Loaded .env"
fi

# Check API key is set
if [ -z "$AI_INTEGRATIONS_OPENAI_API_KEY" ] || [ "$AI_INTEGRATIONS_OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
  echo ""
  echo "⚠️  Missing OpenAI API key!"
  echo "   Open the .env file in your verse-for-you folder"
  echo "   and replace 'your-openai-api-key-here' with your key"
  echo "   from: https://platform.openai.com/api-keys"
  echo ""
  echo "   Then run this script again."
  echo ""
  exit 1
fi

# Start the server in the background
echo "▶ Starting API server on port 5000..."
NODE_ENV=development ./node_modules/.bin/tsx server/index.ts &
SERVER_PID=$!

sleep 2

# Start Expo web on port 8082 (8081 may be in use)
echo "▶ Starting Expo web at http://localhost:8082 ..."
./node_modules/.bin/expo start --web --port 8082

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
