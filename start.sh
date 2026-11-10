#!/bin/bash
echo ""
echo "🐔 =================================================="
echo "   NiaFarm - Poultry Farm Management System"
echo "   =================================================="
echo ""

# Kill any existing instance on port 3000
fuser -k 3000/tcp 2>/dev/null

# Start the server
node backend/server.js &
SERVER_PID=$!

sleep 1

echo "   ✅ Server started (PID: $SERVER_PID)"
echo "   🌐 Open your browser: http://localhost:3000"
echo ""
echo "   Default login after registration:"
echo "   - Register a new account on the login page"
echo "   - Then add your first farm to get started"
echo ""
echo "   Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

wait $SERVER_PID
