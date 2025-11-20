#!/bin/bash

# =============================================================================
# Credential Rotation Helper Script
# =============================================================================
# This script helps you update credentials after security incident
# Usage: ./scripts/rotate-credentials.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  🔐 Credential Rotation Assistant"
echo "=================================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env file first"
    exit 1
fi

echo -e "${BLUE}This script will help you update credentials in .env${NC}"
echo -e "${YELLOW}⚠️  Make sure you've already:${NC}"
echo "  1. Revoked old Render API key"
echo "  2. Generated new TON wallet"
echo "  3. Revoked Telegram bot token"
echo "  4. Revoked Trigger.dev API key"
echo ""
read -p "Have you completed these steps? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Please complete credential revocation first!${NC}"
    echo "See: URGENT_ACTIONS_REQUIRED.md"
    exit 1
fi

echo ""
echo "=================================================="
echo "  Updating .env file"
echo "=================================================="
echo ""

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓${NC} Backed up current .env"

# Function to update env variable
update_env_var() {
    local var_name=$1
    local var_description=$2
    local current_value=$(grep "^${var_name}=" .env | cut -d '=' -f2- | tr -d '"' || echo "")
    
    echo ""
    echo -e "${BLUE}${var_name}${NC}"
    echo "  Description: ${var_description}"
    
    if [ -n "$current_value" ]; then
        echo "  Current: ${current_value:0:20}..."
    else
        echo "  Current: (not set)"
    fi
    
    read -p "  New value (or press Enter to skip): " new_value
    
    if [ -n "$new_value" ]; then
        if grep -q "^${var_name}=" .env; then
            # Update existing
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^${var_name}=.*|${var_name}=\"${new_value}\"|" .env
            else
                # Linux
                sed -i "s|^${var_name}=.*|${var_name}=\"${new_value}\"|" .env
            fi
            echo -e "  ${GREEN}✓${NC} Updated"
        else
            # Add new
            echo "${var_name}=\"${new_value}\"" >> .env
            echo -e "  ${GREEN}✓${NC} Added"
        fi
    else
        echo -e "  ${YELLOW}⊘${NC} Skipped"
    fi
}

# Update critical credentials
echo ""
echo "=== TON Wallet ==="
update_env_var "TON_WALLET_MNEMONIC" "24-word recovery phrase from 'npm run generate:wallet'"
update_env_var "PLATFORM_TON_WALLET" "TON wallet address (EQ...)"

echo ""
echo "=== Telegram Bot ==="
update_env_var "TELEGRAM_BOT_TOKEN" "Bot token from @BotFather"

echo ""
echo "=== API Keys ==="
update_env_var "RENDER_API_KEY" "Render API key (if using in scripts)"
update_env_var "TRIGGER_API_KEY" "Trigger.dev API key"

echo ""
echo "=== Optional Exchange APIs ==="
update_env_var "COINGECKO_API_KEY" "CoinGecko API key (optional)"
update_env_var "COINMARKETCAP_API_KEY" "CoinMarketCap API key (optional)"
update_env_var "KRAKEN_API_KEY" "Kraken API key (optional)"
update_env_var "KRAKEN_API_SECRET" "Kraken API secret (optional)"

echo ""
echo "=================================================="
echo "  Next Steps"
echo "=================================================="
echo ""
echo -e "${YELLOW}1. Update Render Environment Variables:${NC}"
echo "   → Go to: https://dashboard.render.com"
echo "   → Service: telegram-payment-gateway"
echo "   → Environment tab"
echo "   → Update these variables:"
echo "     - TON_WALLET_MNEMONIC"
echo "     - TELEGRAM_BOT_TOKEN"
echo "     - PLATFORM_TON_WALLET"
echo ""
echo -e "${YELLOW}2. Verify Render deployment:${NC}"
echo "   → Wait for auto-redeploy to complete"
echo "   → Check: https://your-service.onrender.com/health"
echo ""
echo -e "${YELLOW}3. Test TON wallet:${NC}"
echo "   → Check new wallet balance: https://tonscan.org"
echo "   → Verify old wallet is empty"
echo ""
echo -e "${YELLOW}4. Test Telegram bot:${NC}"
echo "   → Send test message to your bot"
echo "   → Verify bot responds correctly"
echo ""
echo -e "${GREEN}✓ Local .env updated successfully!${NC}"
echo ""
echo "Backup saved to: .env.backup.*"
echo ""
