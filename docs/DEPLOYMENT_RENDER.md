# Render Deployment Guide

**Last Updated**: November 20, 2025  
**Status**: ✅ Configured and Deployed  
**Service ID**: srv-d4d94fggjchc73dr0nug  
**Region**: Ohio  
**URL**: https://telegram-payment-gateway.onrender.com

This document captures everything required to deploy the Telegram Payment Gateway on Render.com using the supplied `render.yaml` blueprint. The blueprint provisions the API, background workers, managed Redis, and managed PostgreSQL while running database migrations automatically before each deploy.

---

## Recent Deployment Updates (November 20, 2025)

- ✅ **Security Incident Resolved** - All exposed credentials rotated and secured
- ✅ **Environment Variables Updated** - New TON wallet, Telegram bot token, Render API key
- ✅ **Trigger.dev Integration** - Automated deployments configured (project: proj_fqtizcvgqqorjbcikxsa)
- ✅ **Git History Cleaned** - Removed accidentally committed secrets from repository
- ✅ **Deployment Status** - Auto-deploy enabled on main branch

---

## Prerequisites

- Render account with access to Render Blueprints
- GitHub repository: toxzak-svg/telegram-payment-gateway
- Render CLI (optional). Install: `npm install -g render`
- **IMPORTANT**: Never commit secrets to Git. Use Render dashboard or API to set environment variables

---

## Blueprint Overview

| Component | Type | Notes |
|-----------|------|-------|
| `telegram-payment-api` | Web Service | Runs Express API on port `10000`, exposes `/health`, runs `npm run migrate` before each deploy. |
| `worker-deposit-monitor` | Background worker | Executes `packages/core/dist/workers/deposit-settlement.worker.js` for deposit + settlement monitoring. |
| `worker-fee-collection` | Background worker | Executes `packages/core/dist/workers/fee-collection.worker.js` to keep fee ledgers in sync. |
| `tg-payment-redis` | Redis | Internal queue/cache for rate locking + background jobs. |
| `tg-payment-db` | PostgreSQL | Stores all platform state. Connection string automatically injected into every service via `DATABASE_URL`. |

Services share two env-var groups defined near the top of `render.yaml`:

- `shared-runtime`: non-secret config (Node version, TON endpoints, liquidity pool defaults, etc.).
- `shared-secrets`: all credentials and sensitive API keys. Every service that needs access simply references these groups via `envVarGroups`.

## Environment Variables

Render will prompt for every `sync: false` variable on first deploy. Keep copies in a secure secret manager so you can update them quickly if deploys fail. Values marked as _optional_ may be blank.

### shared-runtime (non-secret defaults)

| Key | Purpose | Default |
|-----|---------|---------|
| `NODE_ENV` | Runtime mode | `production` |
| `NODE_VERSION` | Node runtime | `20.11.0` |
| `TON_API_URL` | TON RPC endpoint | `https://toncenter.com/api/v2/jsonRPC` |
| `TON_MAINNET` | `true` for mainnet | `"true"` |
| `TON_WORKCHAIN` | Workchain id | `"0"` |
| `DEDUST_API_URL` | DeDust API base | `https://api.dedust.io` |
| `STONFI_API_URL` | Ston.fi API base | `https://api.ston.fi` |
| `DEX_SLIPPAGE_TOLERANCE` | Swap slippage pct | `0.5` |
| `MIN_CONVERSION_STARS` | Minimum Stars allowed | `100` |
| `RATE_LOCK_DURATION_SECONDS` | Rate lock TTL | `300` |
| `MAX_PENDING_CONVERSIONS` | Back-pressure guard | `10` |
| `P2P_POOL_REFRESH_INTERVAL` | DEX refresh cadence | `30` |
| `PLATFORM_TON_WALLET` | Target custodial wallet | _set in dashboard_ |

### shared-secrets (must be supplied manually)

| Key | Description |
|-----|-------------|
| `TON_WALLET_MNEMONIC` | 24-word production mnemonic with enough TON for fees. |
| `TON_API_KEY` | TON RPC API token. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token handling Stars webhooks. |
| `TELEGRAM_WEBHOOK_SECRET` | Signature expected on Telegram webhook payloads. |
| `API_SECRET_KEY` | Internal signing key for webhook + SDK auth. |
| `JWT_SECRET` | JWT signing key for any session tokens. |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex string for encrypting custody wallets. |
| `COINGECKO_API_KEY` (_optional_) | Needed only if CoinGecko is enabled. |
| `COINMARKETCAP_API_KEY` (_optional_) | Needed only if CoinMarketCap fallback is enabled. |
| `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` (_optional_) | Required if Kraken off-ramps are enabled. |
| `COINLIST_API_KEY` / `COINLIST_API_SECRET` (_optional_) | Required for CoinList settlements. |

### Service-specific variables

| Service | Key | Source |
|---------|-----|--------|
| All | `DATABASE_URL` | Auto-injected from `tg-payment-db`. |
| All | `REDIS_URL` | Auto-injected from `tg-payment-redis`. |
| API | `PORT` | Hard-coded to `10000` (Render automatically routes HTTP traffic here). |

No additional manual wiring is necessary—workers inherit the shared env groups and DB credentials automatically.

## Deploying With Render MPC / CLI

1. **Authenticate**
   ```bash
   render login
   ```
2. **Preview blueprint changes locally** (optional but helpful while iterating):
   ```bash
   render blueprint plan --file render.yaml
   ```
3. **Launch or update the stack** (this creates/updates all services defined in the blueprint). Depending on your CLI version the subcommand may be `deploy` or the older `launch`:
   ```bash
   render blueprint deploy --file render.yaml --name telegram-payment-gateway
   # or
   render blueprint launch --file render.yaml --name telegram-payment-gateway
   ```
   - Use `--dry-run` if you just want to verify what Render would change.
   - You can add `--from-branch main` to pin the branch Render should build.
4. **Populate secrets**: the deploy command pauses if any `sync: false` env vars are missing. Supply them inline or via `--env` files per Render's CLI docs.
5. **Watch the build**: the CLI streams build + migration logs. Each deploy runs `npm run migrate` before releasing traffic, guaranteeing schema drift is handled.

> **Note:** If your Render account does not yet have access to the MPC/CLI workflow, you can still apply the same blueprint in the Render dashboard: _Blueprints → New Blueprint → Connect GitHub repo → Select `render.yaml` → Configure env groups → Launch_. Once deployed, future pushes to the tracked branch trigger builds if `autoDeploy` is enabled (currently left `false` so you can promote manually).

## Post-Deployment Checklist

1. Confirm `/health` returns 200 via the Render web service public URL.
2. Check worker logs to ensure deposit monitoring + fee collection loops start without throwing.
3. Trigger a dry-run Stars payment via the Telegram sandbox and confirm a payment record appears in Postgres.
4. Review Redis metrics—if background workers fail to consume jobs, verify `REDIS_URL` is populated and accessible inside both workers.
5. Back up the Render-provided Postgres connection string and rotation credentials somewhere safe.

## Redeploys and Rollbacks

- Any change to the schema should include a migration; Render automatically runs the migrations on each deploy, so ensure they are idempotent.
- Set `autoDeploy: true` on services in `render.yaml` if you want Render to deploy on every git push to `main`.
- Roll back by selecting a previous deploy in Render's dashboard or using `render deploy rollback <service> --deploy <id>` via CLI.

## Troubleshooting

- **Migrations fail**: fix the offending migration locally, push a patch, and redeploy. Because migrations run before new code is released, a failure keeps the previous version live.
- **Health checks keep failing**: inspect API logs and confirm `PORT=10000` is not being overridden. Render will restart the service automatically until `/health` passes.
- **Workers exit immediately**: usually indicates missing TON credentials. Verify the `shared-secrets` env group was attached to both workers.

Once these steps are complete, Render will continuously run the API and workers, while the CLI (MPC) commands above give you reproducible deployments straight from version control.
