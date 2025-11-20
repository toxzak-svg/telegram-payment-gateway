# Render Environment Variables Setup Guide

This guide provides step-by-step instructions for configuring all required environment variables on Render.com for the Telegram Payment Gateway.

## 🚨 Critical Variables (Must Configure Before Deploy)

### Database & Infrastructure
| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| `DATABASE_URL` | **Auto-configured by Render** | Render automatically injects this from your PostgreSQL service |
| `REDIS_URL` | **Auto-configured by Render** | Render automatically injects this from your Redis service |

### TON Blockchain (Required)
| Variable | Example | How to Obtain |
|----------|---------|---------------|
| `TON_WALLET_MNEMONIC` | `word1 word2 word3 ... word24` | Generate using: `npm run generate:wallet` or TON Wallet app |
| `TON_API_KEY` | `YOUR_TONX_API_KEY` | Get from https://toncenter.com or https://tonapi.io |
| `TON_API_URL` | `https://toncenter.com/api/v2/jsonRPC` | Already set in render.yaml |
| `PLATFORM_TON_WALLET` | `EQxx...xx` | Your main wallet address for collecting fees (starts with EQ or UQ) |

### Telegram Bot (Required)
| Variable | Example | How to Obtain |
|----------|---------|---------------|
| `TELEGRAM_BOT_TOKEN` | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` | Create bot via [@BotFather](https://t.me/BotFather) on Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32+ char string | Generate: `openssl rand -hex 32` |

### Security Keys (Required)
| Variable | Purpose | How to Generate |
|----------|---------|-----------------|
| `API_SECRET_KEY` | Internal API signing | `openssl rand -hex 32` |
| `JWT_SECRET` | Session token signing | `openssl rand -hex 32` |
| `WALLET_ENCRYPTION_KEY` | Encrypt custody wallets | `openssl rand -hex 32` |

### Exchange Rate APIs (Optional but Recommended)
| Variable | Free Tier | Get API Key |
|----------|-----------|-------------|
| `COINGECKO_API_KEY` | Yes (50 calls/min) | https://www.coingecko.com/en/api |
| `COINMARKETCAP_API_KEY` | Yes (333 calls/day) | https://coinmarketcap.com/api/ |

### Fiat Settlement (Optional - Only if Using Off-Ramps)
| Variable | Required When | Get API Key |
|----------|---------------|-------------|
| `KRAKEN_API_KEY` | Using Kraken for fiat conversion | https://www.kraken.com/u/security/api |
| `KRAKEN_API_SECRET` | Using Kraken for fiat conversion | Same as above |
| `COINLIST_API_KEY` | Using CoinList for settlements | https://coinlist.co/settings/api |
| `COINLIST_API_SECRET` | Using CoinList for settlements | Same as above |

---

## 📋 Step-by-Step Setup on Render

### Method 1: Using Render Dashboard

1. **Navigate to your Render Dashboard**
   - Go to https://dashboard.render.com

2. **Select Your Service**
   - Click on your `telegram-payment-api` service

3. **Configure Environment Variables**
   - Go to "Environment" tab
   - Click "Add Environment Variable"

4. **Add Required Variables** (one by one):

   **TON Configuration:**
   ```
   TON_WALLET_MNEMONIC = your 24 word mnemonic phrase here
   TON_API_KEY = your_tonx_or_toncenter_key
   PLATFORM_TON_WALLET = EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Telegram Configuration:**
   ```
   TELEGRAM_BOT_TOKEN = 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_WEBHOOK_SECRET = <generated using openssl rand -hex 32>
   ```

   **Security Keys:**
   ```
   API_SECRET_KEY = <generated using openssl rand -hex 32>
   JWT_SECRET = <generated using openssl rand -hex 32>
   WALLET_ENCRYPTION_KEY = <generated using openssl rand -hex 32>
   ```

   **Exchange Rate APIs (Optional):**
   ```
   COINGECKO_API_KEY = your_coingecko_key_here
   COINMARKETCAP_API_KEY = your_coinmarketcap_key_here
   ```

5. **Repeat for Worker Services**
   - Configure the same variables for:
     - `worker-deposit-monitor`
     - `worker-fee-collection`

6. **Save and Deploy**
   - Click "Save Changes"
   - Render will automatically redeploy with new environment variables

### Method 2: Using Render Blueprint (render.yaml)

The `render.yaml` file already includes placeholders for all required variables. When deploying:

1. **Deploy the Blueprint:**
   ```bash
   render blueprint deploy --file render.yaml
   ```

2. **Render will prompt for each `sync: false` variable:**
   - Follow the prompts to enter each secret
   - Or use environment files (see below)

3. **Using Environment Files:**
   ```bash
   # Create a .env.render file with your secrets
   cat > .env.render << 'EOF'
   TON_WALLET_MNEMONIC=word1 word2 ... word24
   TON_API_KEY=your_key_here
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
   API_SECRET_KEY=your_api_secret
   JWT_SECRET=your_jwt_secret
   WALLET_ENCRYPTION_KEY=your_encryption_key
   PLATFORM_TON_WALLET=EQxxx...xxx
   EOF

   # Deploy with environment file
   render blueprint deploy --file render.yaml --env-file .env.render
   ```

---

## 🔐 Generating Required Secrets

### 1. Generate TON Wallet Mnemonic

**Option A: Using this project's script:**
```bash
npm run generate:wallet
```

**Option B: Using TON Wallet:**
- Download TON Wallet from https://ton.org
- Create a new wallet
- Save the 24-word recovery phrase
- **⚠️ IMPORTANT:** Fund this wallet with at least 5-10 TON for transaction fees

### 2. Get TON API Key

**TonCenter (Recommended):**
1. Visit https://toncenter.com
2. Register for a free account
3. Go to API Keys section
4. Copy your API key

**Alternative: TON API:**
1. Visit https://tonapi.io
2. Sign up and get API key
3. Update `TON_API_URL` to `https://tonapi.io/v2`

### 3. Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow prompts to name your bot
4. Copy the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Enable payments:
   ```
   /mybots → Select your bot → Payments → Connect Telegram Stars
   ```

### 4. Generate Random Secrets

**On Linux/Mac:**
```bash
# Generate all secrets at once
echo "API_SECRET_KEY=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)"
```

**On Windows (PowerShell):**
```powershell
# Generate each secret
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 5. Get Platform TON Wallet Address

This should be your main custodial wallet where fees are collected:

1. **If using existing wallet:** Copy the address from your TON Wallet app
2. **If generating new wallet:** Use the address from step 1 above
3. **Format:** Must start with `EQ` (mainnet) or `UQ` (testnet)

**Update in Render:**
```bash
# Or via CLI
npm run wallet:update EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ✅ Verification Checklist

After configuring all environment variables, verify your setup:

### 1. Database Connection
```bash
# Check if DATABASE_URL is set
curl https://your-api.onrender.com/health
# Should return: {"status":"ok","database":"connected"}
```

### 2. TON Integration
- [ ] `TON_WALLET_MNEMONIC` contains 24 words separated by spaces
- [ ] `TON_API_KEY` is valid (test at https://toncenter.com)
- [ ] `PLATFORM_TON_WALLET` starts with `EQ` or `UQ`
- [ ] Wallet has sufficient TON balance (5+ TON recommended)

### 3. Telegram Bot
- [ ] `TELEGRAM_BOT_TOKEN` is valid (test by sending `/start` to your bot)
- [ ] Telegram Stars payments enabled in BotFather
- [ ] `TELEGRAM_WEBHOOK_SECRET` is at least 32 characters

### 4. Security Keys
- [ ] All four secrets (`API_SECRET_KEY`, `JWT_SECRET`, `WALLET_ENCRYPTION_KEY`, `TELEGRAM_WEBHOOK_SECRET`) are different
- [ ] Each is at least 32 characters long
- [ ] Keys are stored securely in a password manager

### 5. Optional APIs
- [ ] `COINGECKO_API_KEY` works (test at https://www.coingecko.com/en/api)
- [ ] `COINMARKETCAP_API_KEY` works (test at https://coinmarketcap.com/api/)

---

## 🚨 Common Issues & Solutions

### Issue: "Database connection failed"
**Solution:** 
- Verify `DATABASE_URL` is auto-injected by Render
- Check PostgreSQL service is running
- Review database service logs in Render dashboard

### Issue: "TON wallet not initialized"
**Solution:**
- Ensure `TON_WALLET_MNEMONIC` has exactly 24 words
- Check for extra spaces or line breaks
- Verify mnemonic is enclosed in quotes if it contains spaces

### Issue: "Telegram webhook verification failed"
**Solution:**
- Regenerate `TELEGRAM_WEBHOOK_SECRET`
- Ensure the same secret is used in your Telegram bot settings
- Check webhook URL is HTTPS (Render provides this automatically)

### Issue: "Rate limiting on exchange APIs"
**Solution:**
- Sign up for paid tier of CoinGecko/CoinMarketCap
- Or remove API keys to use fallback public endpoints (slower)

### Issue: "Worker services crash on startup"
**Solution:**
- Check worker logs for specific error
- Verify all shared environment variables are set
- Ensure workers can connect to database and Redis

---

## 📝 Environment Variables Quick Reference

Copy this template and fill in your values:

```bash
# ========================================
# RENDER ENVIRONMENT VARIABLES TEMPLATE
# ========================================

# Database (Auto-configured by Render)
DATABASE_URL=<auto-injected>
REDIS_URL=<auto-injected>

# TON Blockchain
TON_WALLET_MNEMONIC="word1 word2 word3 ... word24"
TON_API_KEY=your_ton_api_key_here
PLATFORM_TON_WALLET=EQxxxxxxxxxxxxxxxxxxxxxxxxx
TON_API_URL=https://toncenter.com/api/v2/jsonRPC
TON_MAINNET=true

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>

# Security
API_SECRET_KEY=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
WALLET_ENCRYPTION_KEY=<openssl rand -hex 32>

# Exchange Rate APIs (Optional)
COINGECKO_API_KEY=your_coingecko_key
COINMARKETCAP_API_KEY=your_cmc_key

# Fiat Settlement (Optional)
KRAKEN_API_KEY=your_kraken_key
KRAKEN_API_SECRET=your_kraken_secret
COINLIST_API_KEY=your_coinlist_key
COINLIST_API_SECRET=your_coinlist_secret
```

---

## 🔄 Updating Environment Variables

To update variables after initial deployment:

**Via Dashboard:**
1. Go to Service → Environment tab
2. Click on variable to edit
3. Update value
4. Click "Save Changes"
5. Service will automatically redeploy

**Via Render CLI:**
```bash
# Update a single variable
render env set TON_API_KEY=new_key_value --service telegram-payment-api

# Update multiple variables
render env set \
  TON_API_KEY=new_key \
  TELEGRAM_BOT_TOKEN=new_token \
  --service telegram-payment-api
```

---

## 📞 Support

If you encounter issues:
1. Check Render service logs: Dashboard → Service → Logs
2. Review this documentation: `/docs/DEPLOYMENT_RENDER.md`
3. Test environment variables locally first: `npm run dev`
4. Verify all secrets are correctly formatted (no extra spaces/newlines)

**Need help?** Check the project's GitHub issues or create a new one with:
- Service logs from Render
- Environment variable names (not values!)
- Error messages
