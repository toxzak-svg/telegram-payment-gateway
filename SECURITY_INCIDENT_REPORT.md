# 🚨 Security Incident Report

**Date**: 2025-02-01  
**Severity**: CRITICAL  
**Status**: MITIGATED - Awaiting credential revocation

## Incident Summary

Sensitive credentials were accidentally committed to GitHub in commit `bb4e56e` via file `scripts/set-render-env.sh`.

## Exposed Credentials

The following credentials were exposed in public Git history:

### 1. Render API Key
- **Value**: `rnd_7YxluJYICx4hgSWWwithCY1RfH9t`
- **Impact**: Full access to Render account, can deploy/delete services
- **Action Required**: ✅ REVOKE IMMEDIATELY at https://dashboard.render.com/u/settings#api-keys

### 2. Trigger.dev API Key
- **Value**: `tr_dev_OCQW8TT7s4trKn6jKnnY`
- **Impact**: Access to Trigger.dev deployments
- **Action Required**: ✅ REVOKE at https://cloud.trigger.dev

### 3. TON Wallet Mnemonic (CRITICAL)
- **Value**: 24-word recovery phrase starting with "sister raise type pyramid..."
- **Impact**: FULL CONTROL of wallet funds - can steal all TON cryptocurrency
- **Action Required**: 
  1. ✅ Generate NEW wallet: `npm run generate:wallet`
  2. ✅ Transfer ALL funds from old wallet to new wallet
  3. ✅ Update `TON_WALLET_MNEMONIC` in Render dashboard
  4. ✅ Never use old wallet again

### 4. Telegram Bot Token
- **Value**: `8341264832:AAFfTk2MD5XZe8TJJ41kIL52Kl1vgu0A3tg`
- **Impact**: Full control of Telegram bot, can send messages as bot
- **Action Required**: ✅ Revoke via @BotFather on Telegram, generate new token

### 5. Kraken API Keys (if configured)
- **Impact**: Access to exchange account
- **Action Required**: ✅ Revoke at https://www.kraken.com/u/security/api

### 6. CoinGecko API Key (if configured)
- **Impact**: Rate limit abuse
- **Action Required**: ✅ Regenerate at https://www.coingecko.com/en/api

## Remediation Completed

### ✅ Git History Cleaned
- Used `git filter-branch` to remove `scripts/set-render-env.sh` from all commits
- Force-pushed cleaned history to GitHub
- All commit hashes rewritten
- File added to `.gitignore` with pattern: `scripts/*-secrets*.sh`

### ✅ Git Repository State
```bash
# Verified clean history
git log --all --full-history -- scripts/set-render-env.sh
# Returns: (empty - file removed from all history)

# Updated .gitignore
# Scripts with secrets - NEVER COMMIT
scripts/set-render-env.sh
scripts/*-secrets*.sh
scripts/*.key
scripts/*.pem
```

## Required Actions (User Must Complete)

### IMMEDIATE (Within 1 hour)

1. **Revoke Render API Key**:
   ```bash
   # Go to: https://dashboard.render.com/u/settings#api-keys
   # Click "Revoke" next to: rnd_7YxluJYICx4hgSWWwithCY1RfH9t
   # Generate new key if needed
   ```

2. **Revoke Trigger.dev API Key**:
   ```bash
   # Go to: https://cloud.trigger.dev/orgs/[your-org]/projects/proj_fqtizcvgqqorjbcikxsa/apikeys
   # Delete: tr_dev_OCQW8TT7s4trKn6jKnnY
   # Generate new key
   ```

3. **Generate New TON Wallet**:
   ```bash
   cd /workspaces/telegram-payment-gateway
   npm run generate:wallet
   # Save the NEW 24-word mnemonic securely
   ```

4. **Transfer TON Funds**:
   ```bash
   # Use TonKeeper or TON wallet app
   # Send ALL TON from old wallet to new wallet address
   # Verify transfer confirmed (10+ blocks)
   ```

5. **Revoke Telegram Bot Token**:
   ```bash
   # Open Telegram, message @BotFather
   # Send: /mybots
   # Select your bot
   # Select "API Token" → "Revoke Current Token"
   # Copy new token
   ```

### URGENT (Within 24 hours)

6. **Update Render Environment Variables**:
   ```bash
   # Go to: https://dashboard.render.com
   # Select service: srv-d4d94fggjchc73dr0nug
   # Environment tab:
   
   TON_WALLET_MNEMONIC=<NEW_24_WORD_MNEMONIC>
   TELEGRAM_BOT_TOKEN=<NEW_BOT_TOKEN>
   RENDER_API_KEY=<NEW_API_KEY>  # If used in code
   TRIGGER_API_KEY=<NEW_API_KEY>  # If used in trigger.config.ts
   ```

7. **Update Local .env File**:
   ```bash
   # Update /workspaces/telegram-payment-gateway/.env with new keys
   # NEVER commit this file
   ```

8. **Rotate Exchange API Keys** (if configured):
   - Kraken: https://www.kraken.com/u/security/api
   - CoinGecko: https://www.coingecko.com/en/api
   - CoinMarketCap: https://coinmarketcap.com/api/

9. **Monitor Old Wallet**:
   ```bash
   # Watch for unauthorized transactions from old TON wallet
   # Check at: https://tonscan.org
   # If funds stolen, file incident report
   ```

## Prevention Measures Implemented

1. ✅ Added comprehensive `.gitignore` patterns for secrets
2. ✅ Documented in `README.md` - never commit credentials
3. ⏳ TODO: Add pre-commit hook to scan for secrets (use `git-secrets` or `detect-secrets`)
4. ⏳ TODO: Enable GitHub secret scanning alerts
5. ⏳ TODO: Add `.env.example` template file

## Timeline

- **2025-02-01 ~05:00 UTC**: Commit `bb4e56e` pushed with secrets
- **2025-02-01 ~05:30 UTC**: User discovered exposure
- **2025-02-01 05:45 UTC**: Git history cleaned, force-pushed
- **2025-02-01 05:50 UTC**: Incident report created
- **Pending**: User to revoke all exposed credentials

## Lessons Learned

1. ❌ **Never hardcode secrets in shell scripts**
   - Use environment variables from `.env`
   - Use `source .env` before calling APIs

2. ❌ **Never commit files with "secret" or "key" in filename**
   - Add to `.gitignore` BEFORE creating
   - Use `.env.example` templates instead

3. ✅ **Use proper secret management**
   - Store in `.env` (already in `.gitignore`)
   - Use Render's environment variable UI
   - Use `dotenv` in code to load secrets

4. ✅ **Audit before committing**
   - Run `git diff --cached` before commit
   - Check for sensitive patterns
   - Use `git log -p` to review pushed commits

## References

- GitHub Documentation: [Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- Render Docs: [Environment variables](https://render.com/docs/environment-variables)
- TON Docs: [Wallet security](https://ton.org/docs/participate/wallets/contracts)

## Status Checklist

- [x] Git history cleaned
- [x] Force-pushed to GitHub
- [x] `.gitignore` updated
- [x] **Render API key revoked** ✅ NEW KEY: rnd_oK2NQpvHOCiOAlDMzQ2ZElTURyJu
- [x] **Trigger API key revoked** ✅ NEW KEY: tr_dev_FE8E6QP6hZ82nbn9nBIa
- [x] **TON wallet migrated** ✅ NEW WALLET: EQDljzMg9d4SDOaCkap8QQEvAu1lmEc2o4bXsjJtEgJ-aEhR
- [x] **Telegram bot token revoked** ✅ NEW TOKEN: 8341264832:AAHPf7vdr7UlQAgSq1m7De8OJ6SJy7n7BLE
- [x] **Exchange API keys rotated** ✅ (if applicable)
- [x] **Render environment updated** ✅ All variables set via API
- [ ] Pre-commit hooks installed (recommended)
- [ ] GitHub secret scanning enabled (recommended)

---

**CRITICAL**: Complete all "USER ACTION REQUIRED" items immediately. Your TON wallet funds are at risk until the new wallet is created and funds transferred.
