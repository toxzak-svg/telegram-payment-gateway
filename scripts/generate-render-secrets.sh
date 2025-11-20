#!/bin/bash

# =============================================================================
# Render Environment Variables Generator
# =============================================================================
# This script generates all required secrets for Render deployment
# Usage: ./scripts/generate-render-secrets.sh
# =============================================================================

set -e

echo "=================================================="
echo "  Telegram Payment Gateway - Render Secrets"
echo "=================================================="
echo ""
echo "Generating required environment variables..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate secrets
API_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Output file
OUTPUT_FILE=".env.render"

# Create the environment file
cat > "$OUTPUT_FILE" << EOF
# =============================================================================
# RENDER ENVIRONMENT VARIABLES
# Generated: $(date)
# =============================================================================
# IMPORTANT: 
# 1. Copy these values to your Render dashboard
# 2. Fill in the REQUIRED values marked with TODO
# 3. Keep this file secure and never commit to git
# =============================================================================

# ===================================================================
# DATABASE & INFRASTRUCTURE (Auto-configured by Render)
# ===================================================================
# DATABASE_URL=<auto-injected-by-render>
# REDIS_URL=<auto-injected-by-render>

# ===================================================================
# TON BLOCKCHAIN (REQUIRED)
# ===================================================================
# TODO: Generate using: npm run generate:wallet
# Must be 24 words separated by spaces
TON_WALLET_MNEMONIC="TODO_word1 word2 word3 ... word24"

# TODO: Get from https://toncenter.com or https://tonapi.io
TON_API_KEY=TODO_your_ton_api_key_here

# TODO: Your main wallet address for collecting fees
# Format: EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PLATFORM_TON_WALLET=TODO_EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Endpoint (already set in render.yaml)
TON_API_URL=https://toncenter.com/api/v2/jsonRPC
TON_MAINNET=true
TON_WORKCHAIN=0

# ===================================================================
# TELEGRAM BOT (REQUIRED)
# ===================================================================
# TODO: Create bot via @BotFather on Telegram
# Format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_TOKEN=TODO_your_bot_token_here

# Auto-generated webhook secret
TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET

# ===================================================================
# SECURITY KEYS (Auto-generated)
# ===================================================================
API_SECRET_KEY=$API_SECRET_KEY
JWT_SECRET=$JWT_SECRET
WALLET_ENCRYPTION_KEY=$WALLET_ENCRYPTION_KEY

# ===================================================================
# EXCHANGE RATE APIs (OPTIONAL but recommended)
# ===================================================================
# Get free tier from: https://www.coingecko.com/en/api
COINGECKO_API_KEY=

# Get free tier from: https://coinmarketcap.com/api/
COINMARKETCAP_API_KEY=

# ===================================================================
# FIAT SETTLEMENT (OPTIONAL - only if using off-ramps)
# ===================================================================
# Get from: https://www.kraken.com/u/security/api
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

# Get from: https://coinlist.co/settings/api
COINLIST_API_KEY=
COINLIST_API_SECRET=

# ===================================================================
# DEPLOYMENT CONFIGURATION
# ===================================================================
NODE_ENV=production
PORT=10000
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# P2P DEX Configuration
DEDUST_API_URL=https://api.dedust.io
STONFI_API_URL=https://api.ston.fi
DEX_SLIPPAGE_TOLERANCE=0.5

# Conversion Settings
MIN_CONVERSION_STARS=100
RATE_LOCK_DURATION_SECONDS=300
MAX_PENDING_CONVERSIONS=10
P2P_POOL_REFRESH_INTERVAL=30
EOF

echo -e "${GREEN}✓ Secrets generated successfully!${NC}"
echo ""
echo "=================================================="
echo "  Generated Secrets Summary"
echo "=================================================="
echo ""
echo -e "${BLUE}API_SECRET_KEY:${NC}"
echo "  $API_SECRET_KEY"
echo ""
echo -e "${BLUE}JWT_SECRET:${NC}"
echo "  $JWT_SECRET"
echo ""
echo -e "${BLUE}WALLET_ENCRYPTION_KEY:${NC}"
echo "  $WALLET_ENCRYPTION_KEY"
echo ""
echo -e "${BLUE}TELEGRAM_WEBHOOK_SECRET:${NC}"
echo "  $TELEGRAM_WEBHOOK_SECRET"
echo ""
echo "=================================================="
echo "  Next Steps"
echo "=================================================="
echo ""
echo -e "${YELLOW}1. Complete TODO items in: $OUTPUT_FILE${NC}"
echo "   - Generate TON wallet: npm run generate:wallet"
echo "   - Get TON API key: https://toncenter.com"
echo "   - Create Telegram bot: @BotFather on Telegram"
echo ""
echo -e "${YELLOW}2. Copy values to Render Dashboard:${NC}"
echo "   - Go to https://dashboard.render.com"
echo "   - Select your service"
echo "   - Navigate to Environment tab"
echo "   - Add each variable from $OUTPUT_FILE"
echo ""
echo -e "${YELLOW}3. Or deploy via Render CLI:${NC}"
echo "   render blueprint deploy --file render.yaml --env-file $OUTPUT_FILE"
echo ""
echo -e "${YELLOW}4. Verify deployment:${NC}"
echo "   curl https://your-service.onrender.com/health"
echo ""
echo "=================================================="
echo "  Security Reminder"
echo "=================================================="
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   - Keep $OUTPUT_FILE secure"
echo "   - Never commit to git"
echo "   - Store in password manager"
echo "   - Rotate keys regularly"
echo ""
echo -e "${GREEN}For detailed setup instructions, see:${NC}"
echo "   docs/RENDER_ENV_SETUP.md"
echo ""
