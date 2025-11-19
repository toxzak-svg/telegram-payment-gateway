# Telegram Payment Gateway - Render Deployment

This project is configured for deployment on Render.com with the following services:

## Services

### 1. PostgreSQL Database
- **Name**: `telegram-payment-gateway-db`
- **Plan**: Free
- **Database**: `tg_payment_gateway`

### 2. Redis Cache
- **Name**: `telegram-payment-gateway-redis`
- **Plan**: Free

### 3. Web API Service
- **Name**: `telegram-payment-gateway-api`
- **Plan**: Free
- **Build Command**: `npm install && npm run build && ./render-build.sh`
- **Start Command**: `node packages/api/dist/server.js`

## Quick Deploy

1. **Connect to GitHub**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository: `toxzak-svg/telegram-payment-gateway`

2. **Auto-deployment**:
   - Render will detect `render.yaml` and create all services automatically
   - Database migrations will run during build via `render-build.sh`

3. **Add Required Environment Variables** (via Render Dashboard):
   After deployment, add these secrets in the API service settings:
   
   ```
   TON_WALLET_MNEMONIC=<your 24-word mnemonic>
   TELEGRAM_BOT_TOKEN=<your telegram bot token>
   TON_API_KEY=<optional: toncenter api key>
   COINGECKO_API_KEY=<optional: for better rates>
   COINMARKETCAP_API_KEY=<optional: for better rates>
   WALLET_ENCRYPTION_KEY=<generate 64-char hex: openssl rand -hex 32>
   ```

4. **Health Check**:
   Once deployed, visit: `https://telegram-payment-gateway-api.onrender.com/health`

## Platform Wallet

Your TON wallet for fee collection is already configured:
```
UQABzHv6ODc8RIthqZePq96MSAVwvPL1-VuIePTnEXDi0jTP
```

## Post-Deployment

1. Set up Telegram webhook:
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url": "https://telegram-payment-gateway-api.onrender.com/api/v1/payments/webhook"}'
   ```

2. Test the API:
   ```bash
   curl https://telegram-payment-gateway-api.onrender.com/api/v1/health
   ```

## Manual Deployment Commands

If you prefer manual deployment:

```bash
# Install dependencies
npm install

# Build all workspaces
npm run build

# Run migrations
npm run migrate

# Start production server
NODE_ENV=production node packages/api/dist/server.js
```

## Support

- Dashboard: https://dashboard.render.com/
- Docs: https://render.com/docs
- Repository: https://github.com/toxzak-svg/telegram-payment-gateway
