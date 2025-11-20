# Trigger.dev Integration Guide

This guide explains how to use Trigger.dev to automate deployments to Render.com for the Telegram Payment Gateway.

## 📋 Overview

Trigger.dev provides automated deployment workflows including:

- **Manual deployments** via dashboard
- **Scheduled deployments** (e.g., nightly builds)
- **Webhook-triggered deployments** from GitHub
- **Full deployment pipelines** with migrations and health checks

---

## 🚀 Quick Start

### 1. Prerequisites

- Trigger.dev account (sign up at <https://trigger.dev>)
- Render.com API key
- GitHub repository configured

### 2. Initial Setup

The Trigger.dev CLI has already initialized the project:

```bash
# Development mode (runs tasks locally)
npx trigger.dev@latest dev

# Deploy tasks to Trigger.dev cloud
npx trigger.dev@latest deploy
```

### 3. Environment Variables

Add these to your Trigger.dev project environment:

```bash
# Trigger.dev Settings
TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxxx  # From Trigger.dev dashboard

# Render API Configuration
RENDER_API_KEY=rnd_xxxxxxxxxxxxx  # From Render dashboard > Account Settings
RENDER_API_SERVICE_ID=srv_xxxxxxxxxxxxx  # Your API service ID
RENDER_WORKER_SERVICE_IDS=srv_worker1,srv_worker2  # Comma-separated worker IDs

# Health Check
API_HEALTH_CHECK_URL=https://telegram-payment-api.onrender.com/health
```

---

## 📦 Available Tasks

### 1. Manual Deploy (`manual-deploy`)

Trigger a deployment manually from the Trigger.dev dashboard.

**Usage:**
```typescript
// Via dashboard: trigger with payload
{
  "branch": "main",
  "clearCache": false,
  "serviceIds": ["srv_xxxxx"]  // Optional: specific services
}
```

**Use Cases:**

- Quick hotfixes
- Manual rollouts
- Testing deployments

---

### 2. Full Deployment Pipeline (`full-deployment-pipeline`)

Complete deployment workflow with migrations and health checks.

**Workflow:**
1. Deploy API service
2. Deploy worker services
3. Run database migrations
4. Wait for services to be live
5. Run health check

**Usage:**
```typescript
{
  "apiServiceId": "srv_xxxxx",
  "workerServiceIds": ["srv_worker1", "srv_worker2"],
  "branch": "main",
  "clearCache": false,
  "runMigrations": true,
  "healthCheckUrl": "https://your-api.onrender.com/health"
}
```

---

### 3. GitHub Push Webhook (`github-push-webhook`)

Automatically deploy when code is pushed to specific branches.

**Setup:**

1. **Add webhook to GitHub:**
   - Go to your repo → Settings → Webhooks
   - Add webhook: `https://api.trigger.dev/api/v1/webhooks/github`
   - Content type: `application/json`
   - Events: `Just the push event`

2. **Configure branches:**
   Edit `src/trigger/webhooks.ts`:
   ```typescript
   const deployBranches = ["main", "production"];
   ```

**Behavior:**
- Only deploys on specified branches
- Skips deployment for other branches
- Logs pusher info and commit count

---

### 4. Scheduled Deployment (`scheduled-deployment`)

Run deployments on a schedule (e.g., nightly builds).

**Configure Schedule:**

In Trigger.dev dashboard:
1. Go to your task
2. Set schedule (cron syntax)
3. Example: `0 2 * * *` (every day at 2 AM UTC)

**Or in code:**
```typescript
export const scheduledDeployment = schedules.task({
  id: "scheduled-deployment",
  cron: "0 2 * * *",  // Daily at 2 AM
  run: async (payload) => {
    // ...
  },
});
```

---

### 5. Deploy to Render (`deploy-to-render`)

Low-level task for deploying individual services.

**Usage:**
```typescript
{
  "serviceId": "srv_xxxxx",
  "branch": "main",
  "clearCache": true  // Optional: clear build cache
}
```

---

### 6. Run Migrations (`run-migrations`)

Execute database migrations on Render.

**Usage:**
```typescript
{
  "serviceId": "srv_xxxxx"
}
```

---

## 🔧 Configuration

### Render API Key

Get your Render API key:
1. Go to https://dashboard.render.com/account
2. Scroll to "API Keys"
3. Create new API key
4. Add to Trigger.dev environment variables

### Service IDs

Find your Render service IDs:
1. Go to https://dashboard.render.com
2. Click on your service
3. URL contains service ID: `dashboard.render.com/web/srv_xxxxx`
4. Copy the `srv_xxxxx` part

### Trigger.dev Secret

Get your Trigger secret:
1. Go to https://trigger.dev
2. Select your project
3. Go to "API Keys"
4. Copy the secret key
5. Add to `.env` as `TRIGGER_SECRET_KEY`

---

## 🎯 Common Workflows

### Quick Hotfix Deployment

```bash
# 1. Make your changes
git add .
git commit -m "fix: critical bug fix"
git push origin main

# 2. Trigger deployment from Trigger.dev dashboard
# Task: manual-deploy
# Payload: { "branch": "main" }
```

### Full Production Deployment

```bash
# 1. Test locally
npm run build
npm run test

# 2. Commit and push
git push origin main

# 3. Run full pipeline from Trigger.dev
# Task: full-deployment-pipeline
# Payload: {
#   "apiServiceId": "srv_api",
#   "workerServiceIds": ["srv_worker1", "srv_worker2"],
#   "runMigrations": true,
#   "healthCheckUrl": "https://api.onrender.com/health"
# }
```

### Scheduled Nightly Builds

Set up in Trigger.dev dashboard:
- Task: `scheduled-deployment`
- Schedule: `0 2 * * *` (2 AM daily)
- Automatically runs full pipeline

---

## 🔍 Monitoring

### View Task Runs

1. Go to https://trigger.dev
2. Select your project
3. Click "Runs" tab
4. Filter by task ID

### Logs

All tasks include structured logging:
```typescript
logger.log("🚀 Starting deployment");
logger.warn("⚠️ Warning message");
logger.error("❌ Error occurred");
```

View logs in:
- Trigger.dev dashboard (real-time)
- Render logs (deployment progress)

---

## 🚨 Troubleshooting

### "RENDER_API_KEY not set"

**Solution:**
Add `RENDER_API_KEY` to Trigger.dev environment variables:
1. Trigger.dev dashboard → Project → Settings → Environment
2. Add variable with your Render API key

### "Uncommitted changes detected"

**Solution:**
Commit all changes before deploying:
```bash
git add .
git commit -m "your message"
git push origin main
```

### "Health check failed"

**Solution:**
1. Verify `API_HEALTH_CHECK_URL` is correct
2. Check if Render service is running
3. Verify `/health` endpoint responds

### "Render API error: 401"

**Solution:**
- Invalid API key
- Regenerate key in Render dashboard
- Update in Trigger.dev environment

---

## 📝 Task Reference

| Task ID | Purpose | Duration | Retries |
|---------|---------|----------|---------|
| `manual-deploy` | Quick manual deployment | 10 min | 2 |
| `deploy-to-render` | Deploy single service | 10 min | 2 |
| `run-migrations` | Execute DB migrations | 5 min | 3 |
| `full-deployment-pipeline` | Complete deployment | 15 min | 3 |
| `github-push-webhook` | Auto-deploy on push | 10 min | 2 |
| `scheduled-deployment` | Scheduled deployments | - | 3 |

---

## 🔐 Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use separate API keys** - Dev vs Production
3. **Limit webhook access** - Use GitHub webhook secrets
4. **Monitor failed runs** - Set up alerts in Trigger.dev
5. **Rotate keys regularly** - Every 90 days

---

## 🎓 Learn More

- **Trigger.dev Docs**: https://trigger.dev/docs
- **Render API Docs**: https://render.com/docs/api
- **GitHub Webhooks**: https://docs.github.com/webhooks

---

## 💡 Tips

1. **Test locally first**: Use `npx trigger.dev@latest dev` for testing
2. **Use clear cache sparingly**: Slows down builds
3. **Monitor health checks**: Set up alerts for failures
4. **Version your tasks**: Use semantic versioning in task IDs
5. **Document payloads**: Add TypeScript interfaces for type safety

---

## 📞 Support

- **Trigger.dev**: Discord at https://trigger.dev/discord
- **Render**: Support at https://render.com/support
- **Project Issues**: GitHub Issues

---

**Last Updated**: November 20, 2025  
**Status**: Production Ready ✅
