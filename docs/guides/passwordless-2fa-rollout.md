# Passwordless + 2FA — Rollout & Testing Checklist

This checklist is an operational playbook to safely roll out the passwordless login + optional TOTP 2FA feature. Use feature flags for gradual rollout and follow the testing matrix strictly.

1) Preconditions (before deploying code)
- Ensure `database/migrations/016_add_auth_tables.sql` is committed and reviewed.
- Ensure CI includes automated integration tests that exercise: magic-link request, magic-link verify, TOTP provisioning, TOTP verify, backup-code usage, session creation/revocation, and rate-limits.
- Add feature flag config (e.g., `FEATURE_PASSWORDLESS_AUTH=false`) to environment and ensure it defaults to `false` in production.
- Ensure secrets are provisioned: `WALLET_ENCRYPTION_KEY` or KMS credentials for TOTP secret encryption and `EMAIL_SMTP` creds for sending magic links.
- Confirm monitoring (Prometheus/Grafana/Datadog) has a dashboard and alerting for auth metrics described below.

2) Automated Test Matrix (minimum)
- Unit tests (fast):
  - Token sign/verify, `magic_links` single-use enforcement
  - TOTP code generation/verification helper
  - Backup code hashing and one-time use
  - Session store create/revoke logic
- Integration tests (CI):
  - End-to-end magic link flow using test SMTP (capture emails via dev inbox) and test DB: request -> email content -> verify -> session
  - Magic link replay protection: verify that used token returns 4xx
  - TOTP flow: enable -> verify -> login with TOTP
  - Backup code flow: generate -> use -> ensure marked used
  - Rate limit enforcement tests: repeated requests blocked per policy
- Load tests (staging):
  - Simulate magic-link request bursts to validate rate limits and queueing
  - Verify email provider throughput and retry behavior

3) Manual Smoke Tests (pre-release on staging)
- Request a magic link for a test account; confirm the email was produced and the link verifies and creates a session.
- Verify the magic link cannot be used twice.
- Enable TOTP for a test account: scan QR or read secret, confirm provisioning, log out, and log in with magic link + TOTP.
- Verify backup codes are generated, displayed once, and then accepted as alternate second-factor; confirm used backup code is rejected thereafter.
- Ensure unprivileged endpoints still require API key auth (no regressions in API key flows).

4) Feature-Flagged Rollout Plan
- Step 0 — DB Migration: Deploy DB migration (read-only change from code viewpoint). Rollback: none needed (additive).
- Step 1 — Backend: Deploy auth endpoints behind `FEATURE_PASSWORDLESS_AUTH=false`.
- Step 2 — Staging: Flip `FEATURE_PASSWORDLESS_AUTH=true` on staging; run full automated and manual smoke tests.
- Step 3 — Canary: Enable the feature flag for 5% of admin users (or specific admin emails) in production.
- Step 4 — Monitor: Observe metrics and logs for 72 hours. If no anomalies, increase to 25% then 100% in increments (24–72 hours between steps depending on org risk appetite).

5) Monitoring & Alerts (define thresholds)
- Metrics to emit (each as Prometheus counter/gauge or Datadog metric):
  - `auth.magiclink.requests_total` (labels: email_domain, status)
  - `auth.magiclink.verifications_total` (labels: result: success|expired|replay|invalid)
  - `auth.totp.verify_total` (labels: result)
  - `auth.sessions.created_total`
  - `auth.sessions.revoked_total`
  - `auth.failed_attempts` (per email/IP)
- Suggested alerts:
  - High error rate in `auth.magiclink.verifications_total{result!="success"}` > 5% of verifications for 1 hour
  - Spike in `auth.magiclink.requests_total` from a single IP (>100 requests/hour)
  - Repeated TOTP failures for a single account (>10 failures in 1 hour)

6) Observability/Logging
- Log all auth events to `auth_audit` table with minimal safe details: event_type, user_id, ip, user_agent, details (non-sensitive). Do NOT log tokens, secrets, or full codes.
- Instrument endpoints with request ids, latency histograms, and include `X-Request-ID` propagation.

7) Rollback Procedure
- If an issue is detected, first flip the feature flag to `false` to stop new users from using passwordless flows.
- If the issue is DB-related and requires immediate rollback, restore DB from the last backup and follow the standard disaster recovery runbook.
- Communicate via incident channel and follow on-call runbook. Revoke sessions for affected users if compromise suspected.

8) Post-Deployment Verification
- Confirm `auth` metrics are within normal ranges for 48–72 hours.
- Run a reconciliation job to ensure `magic_links` used==1 and no orphaned pending tokens.
- Audit `auth_audit` for unexpected patterns and report in the security channel.

9) Security Review & Compliance
- Ensure TOTP secrets are encrypted and TOTP enable flow requires re-auth (session) to prevent account takeovers.
- If required by policy, produce a short penetration test or focused code review for the auth components prior to 100% rollout.

10) Post-Rollout Tasks
- Add documentation for end-users (FAQ, how to enable/disable TOTP, how to use backup codes) in the Dashboard help center.
- Schedule periodic key rotation for encryption keys and implement KMS-based secret management if not already present.

Smoke test commands (local/staging)
```
# Run unit + integration tests for auth (example)
cd packages/core && npm run test -- -t "auth"
cd packages/api && npm run test -- -t "auth"

# Apply migration locally (psql example)
psql "$DATABASE_URL" -f database/migrations/016_add_auth_tables.sql
```

Return to the main guide to continue implementation and to prepare PR notes.
