#!/bin/bash

# =============================================================================
# Analyze Render Error Logs
# =============================================================================
# Usage: ./scripts/analyze-render-logs.sh
# =============================================================================

set -e

SERVICE_ID="srv-d4d94fggjchc73dr0nug"
RENDER_API_KEY="${RENDER_API_KEY:-rnd_7YxluJYICx4hgSWWwithCY1RfH9t}"

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║        📊 RENDER DEPLOYMENT ANALYSIS                              ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Fetch service info
echo "🔍 Service Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID" | \
  python3 -c '
import sys, json
data = json.load(sys.stdin)
print("Name:", data["name"])
print("Type:", data["type"])
print("Status:", data.get("suspended", "active"))
print("URL:", data["serviceDetails"]["url"])
print("Region:", data["serviceDetails"]["region"])
print("Build Plan:", data["serviceDetails"]["buildPlan"])
print("Auto Deploy:", data["autoDeploy"])
'
echo ""

# Fetch recent deployments
echo "📦 Recent Deployments:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=10" | \
  python3 << 'PYEOF'
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
for i, item in enumerate(data[:5], 1):
    d = item["deploy"]
    status = d["status"]
    emoji = "✅" if status == "live" else "❌" if "failed" in status else "🔄"
    
    created = datetime.fromisoformat(d["createdAt"].replace("Z", "+00:00"))
    finished = d.get("finishedAt")
    duration = "N/A"
    if finished:
        finished_dt = datetime.fromisoformat(finished.replace("Z", "+00:00"))
        duration = str(finished_dt - created).split(".")[0]
    
    print(f"{emoji} Deploy #{i}: {status}")
    print(f"   ID: {d['id']}")
    print(f"   Created: {created.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"   Duration: {duration}")
    print(f"   Commit: {d['commit']['id'][:8]}")
    print()
PYEOF
echo ""

# Get the latest failed deployment details
echo "🔴 Latest Failed Deployment Analysis:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LATEST_DEPLOY=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1" | \
  python3 -c 'import sys, json; print(json.load(sys.stdin)[0]["deploy"]["id"])')

echo "Deploy ID: $LATEST_DEPLOY"
echo ""

# Common deployment failure patterns
echo "💡 Common Deployment Issues to Check:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. ❌ Missing dependencies in package.json"
echo "2. ❌ Build script failures (check TypeScript compilation)"
echo "3. ❌ Missing environment variables"
echo "4. ❌ Database migration errors"
echo "5. ❌ Docker build context issues"
echo "6. ❌ Port configuration problems"
echo "7. ❌ Health check endpoint failures"
echo "8. ❌ Memory/resource limits exceeded"
echo ""

# Check service health
echo "🏥 Service Health Check:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SERVICE_URL=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID" | \
  python3 -c 'import sys, json; print(json.load(sys.stdin)["serviceDetails"]["url"])')

echo "Testing: $SERVICE_URL/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "❌ Service unreachable (connection failed)"
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
fi
echo ""

# Recommendations
echo "📋 Recommended Actions:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Check build logs in Render dashboard:"
echo "   https://dashboard.render.com/web/$SERVICE_ID"
echo ""
echo "2. Verify environment variables are set:"
echo "   - DATABASE_URL"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TON_WALLET_MNEMONIC"
echo "   - All other required secrets"
echo ""
echo "3. Test Docker build locally:"
echo "   docker build -t test-build ."
echo ""
echo "4. Run build command locally:"
echo "   npm ci && npm run build"
echo ""
echo "5. Check database migrations:"
echo "   npm run migrate:status"
echo ""
