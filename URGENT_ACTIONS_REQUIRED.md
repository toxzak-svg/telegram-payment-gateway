# 🚨 URGENT SECURITY ACTIONS REQUIRED

**IMMEDIATE ACTIONS NEEDED - Complete within 1 hour to prevent unauthorized access**

---

## ✅ COMPLETED
- [x] Removed secrets from Git history
- [x] Force-pushed cleaned repository to GitHub
- [x] Updated `.gitignore` to prevent future exposure

---

## ❌ YOU MUST DO NOW (Priority Order)

### 1. REVOKE RENDER API KEY (Highest Risk) ⚠️

**Risk**: Anyone can deploy malicious code to your production service

**Steps**:
1. Go to: https://dashboard.render.com/u/settings#api-keys
2. Find key starting with: `rnd_7YxluJY...`
3. Click **"Revoke"** button
4. (Optional) Generate new key if you need it for automation
5. Update any automation scripts with new key

**Time**: 2 minutes

---

### 2. MIGRATE TON WALLET (Critical - Funds at Risk) 💰

**Risk**: Anyone can steal ALL cryptocurrency from your wallet

**Steps**:

#### A. Generate New Wallet
```bash
cd /workspaces/telegram-payment-gateway
npm run generate:wallet
```

**Save the output** - write down the 24 words on paper!

Example output:
```
Generated TON Wallet:
Mnemonic: word1 word2 word3 ... word24
Address: EQ_new_address_here
```

#### B. Transfer Funds
1. Open TonKeeper or TON Wallet app
2. Import OLD wallet using exposed mnemonic (to check balance)
3. Send 100% of TON balance to NEW wallet address
4. Wait for 10+ confirmations (~3 minutes)
5. Verify on https://tonscan.org

#### C. Update Render Environment
1. Go to: https://dashboard.render.com
2. Select service: **telegram-payment-gateway** (srv-d4d94fggjchc73dr0nug)
3. Go to **Environment** tab
4. Find `TON_WALLET_MNEMONIC` variable
5. Click **Edit** and paste NEW 24-word mnemonic
6. Click **Save Changes**
7. Service will auto-redeploy with new wallet

#### D. Update Local .env
```bash
# Edit .env file and replace:
TON_WALLET_MNEMONIC="NEW_24_WORD_MNEMONIC_HERE"
PLATFORM_TON_WALLET="NEW_WALLET_ADDRESS_HERE"
```

**Time**: 10 minutes + transaction confirmation

---

### 3. REVOKE TELEGRAM BOT TOKEN ⚠️

**Risk**: Anyone can send messages as your bot, intercept payments

**Steps**:
1. Open Telegram app
2. Search for: `@BotFather`
3. Send command: `/mybots`
4. Select your bot from list
5. Select: **API Token**
6. Select: **Revoke Current Token**
7. Confirm revocation
8. BotFather will send you a NEW token
9. Copy new token (format: `123456789:ABCdefGHI...`)

**Update Render**:
1. Go to Render dashboard → Environment tab
2. Find `TELEGRAM_BOT_TOKEN`
3. Edit and paste NEW token
4. Save changes

**Update Local .env**:
```bash
TELEGRAM_BOT_TOKEN="NEW_TOKEN_HERE"
```

**Time**: 5 minutes

---

### 4. REVOKE TRIGGER.DEV API KEY

**Risk**: Unauthorized access to CI/CD deployments

**Steps**:
1. Go to: https://cloud.trigger.dev
2. Navigate to: Organizations → Your Org → Projects
3. Select: **telegram-payment-gateway** (proj_fqtizcvgqqorjbcikxsa)
4. Click: **Settings** → **API Keys**
5. Find key starting with: `tr_dev_OCQW8...`
6. Click **Delete** or **Revoke**
7. (Optional) Generate new key if needed
8. Update `trigger.config.ts` if you regenerate

**Time**: 3 minutes

---

### 5. ROTATE EXCHANGE API KEYS (If Configured)

#### Kraken (if you have account)
1. Go to: https://www.kraken.com/u/security/api
2. Find API keys in list
3. Click **Delete** on all keys
4. Generate new keys if needed
5. Update Render environment: `KRAKEN_API_KEY` and `KRAKEN_API_SECRET`

#### CoinGecko (if configured)
1. Go to: https://www.coingecko.com/en/api/pricing
2. Navigate to your dashboard
3. Regenerate API key
4. Update Render: `COINGECKO_API_KEY`

#### CoinMarketCap (if configured)
1. Go to: https://pro.coinmarketcap.com/account
2. Navigate to API Keys section
3. Regenerate key
4. Update Render: `COINMARKETCAP_API_KEY`

**Time**: 5 minutes per service

---

## Verification Checklist

After completing above steps, verify:

### ✓ Check Render Dashboard
```bash
# Verify new environment variables are set
curl -H "Authorization: Bearer NEW_RENDER_API_KEY" \
  https://api.render.com/v1/services/srv-d4d94fggjchc73dr0nug/env-vars
```

### ✓ Check TON Wallet
```bash
# Old wallet should be EMPTY (0 TON)
# New wallet should have all funds
# Verify at: https://tonscan.org
```

### ✓ Check Telegram Bot
```bash
# Send test message to your bot
# Bot should respond (if auto-reply configured)
# Or check bot status: https://t.me/your_bot
```

### ✓ Check Deployment
```bash
# After Render redeploys with new keys:
curl https://your-service.onrender.com/health
# Should return: {"status":"ok"}
```

---

## Timeline

| Time | Action | Status |
|------|--------|--------|
| Now | Revoke Render API key | ❌ PENDING |
| +5 min | Generate new TON wallet | ❌ PENDING |
| +10 min | Transfer TON funds | ❌ PENDING |
| +15 min | Revoke Telegram token | ❌ PENDING |
| +20 min | Revoke Trigger.dev key | ❌ PENDING |
| +25 min | Update all Render env vars | ❌ PENDING |
| +30 min | Verify deployment works | ❌ PENDING |

---

## What If I Can't Complete This Now?

### Temporary Mitigation (DO THIS IMMEDIATELY)
1. **Pause Render Service**:
   - Dashboard → Service → Settings → "Suspend Service"
   - This prevents unauthorized deployments

2. **Monitor TON Wallet**:
   - Check balance every 30 minutes at https://tonscan.org
   - If you see unauthorized transaction, immediately transfer remaining funds

3. **Monitor Telegram Bot**:
   - Check bot message history for suspicious activity
   - @BotFather → /mybots → [your bot] → Statistics

---

## Questions?

If you need help:
1. **TON Wallet Issues**: https://ton.org/docs/participate/wallets
2. **Render Support**: https://render.com/docs
3. **Telegram Bots**: https://core.telegram.org/bots

---

## After Completing All Steps

1. Mark all items as ✅ in `SECURITY_INCIDENT_REPORT.md`
2. Delete this file: `rm URGENT_ACTIONS_REQUIRED.md`
3. Test your deployment thoroughly
4. Consider enabling 2FA on all accounts:
   - Render.com
   - GitHub
   - Trigger.dev
   - Telegram account

---

**STATUS**: 🚨 CRITICAL - Action required within 1 hour
