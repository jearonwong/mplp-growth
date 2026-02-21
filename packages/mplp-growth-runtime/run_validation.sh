#!/bin/bash
echo "=== DEDUP RUN 1 ==="
npx tsx src/commands/cli.ts outreach --segment foundation --channel email

echo -e "\n=== DEDUP RUN 2 ==="
npx tsx src/commands/cli.ts outreach --segment foundation --channel email

echo -e "\n=== STARTING SERVER ==="
npx tsx src/server/index.ts &
SERVER_PID=$!
sleep 5

echo -e "\n=== /api/health ==="
curl -s http://localhost:3000/api/health | jq

echo -e "\n=== /api/queue ==="
curl -s http://localhost:3000/api/queue | jq '.[0] // empty'

kill -9 $SERVER_PID
echo -e "\n=== DONE ==="
