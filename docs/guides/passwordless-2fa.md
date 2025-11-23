# Passwordless Authentication & Optional 2FA (TOTP)

**Status**: Draft

This document describes the design, security considerations, API, database schema, frontend flows, testing plan, and rollout guidance for adding a secure passwordless login system with optional TOTP-based 2FA to the Dashboard.

**Goals**
- Provide a secure, user-friendly passwordless login flow (magic link / one-time code) for human operators of the Dashboard.
- Offer optional time-based one-time password (TOTP) 2FA as a secondary step for users who want stronger protection.
- Ensure server-side session management for easy revocation and auditability.
- Keep API keys and programmatic integrations unaffected—API key auth remains supported.
- Provide clear migration, testing, and rollout guidance to minimize production risk.

**High-level Flow**
- User visits Dashboard login page and enters their email.
- Backend generates a single-use, time-limited magic link token (JWS/HMAC) and stores a record in `magic_links` with an expiration and nonce. The link is emailed to the user (or displayed as one-time code for internal builds).
- User clicks the magic link. The Dashboard calls `POST /api/v1/auth/magic-link/verify` (or follows a GET redirect) to validate the token. On success the server creates a session record (`sessions`) and issues a short-lived session cookie (and optional refresh token) with `HttpOnly`, `Secure`, `SameSite=Strict` attributes.
- If the user has enabled TOTP, the verify endpoint responds with a 2FA required status and a temporary intermediate token; the frontend prompts the user for the TOTP code and calls `POST /api/v1/auth/totp/verify` to complete authentication.

**Threat Model & Security Principles**
- Threats considered: stolen email access, token interception, replay attacks, CSRF, brute force and credential stuffing, leaked DB, and insider access.
- Mitigations:
  - Magic links are single-use, short-lived (recommended 10–15 minutes) and bound to a nonce stored server-side.
  - Tokens are signed (JWS or HMAC) and include `iat`, `exp`, `jti`, and `aud` claims. Server verifies signature and checks DB record for single-use.
  - Sessions are server-side with a revocable `session_id`. Cookies are `HttpOnly`, `Secure`, `SameSite=Strict` and limited to the dashboard domain.
  - Refresh tokens (if used) are long-lived but stored server-side and rotate on use.
  - Rate-limit authentication endpoints per IP and per email (e.g., 5 requests / 10 minutes per email; 50 / hour per IP) and enforce exponential backoff.
  - TOTP secret keys are encrypted at rest using a KMS or `WALLET_ENCRYPTION_KEY`.
  - Backup codes are one-time-use and stored hashed (bcrypt/argon2) in DB.
  - Audit logs record auth events (issued/used magic link, session create/destroy, TOTP enable/disable) into `auth_audit` for monitoring and forensics.

**Data Model (summary)**
- `magic_links` — stores `id`, `email`, `token_jti`, `expires_at`, `used_at`, `created_at`, `ip`, `user_agent`.
- `sessions` — stores `id` (uuid), `user_id` (nullable for invite-only), `session_token` (opaque id), `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `meta` (JSON) and `ip`/`user_agent`.
- `totp_secrets` — stores `user_id`, `encrypted_secret`, `enabled_at`, `confirmed_at`.
- `backup_codes` — stores `user_id`, `code_hash`, `used_at`, `created_at`.
- `auth_audit` — audit log for auth events.

See the sample migration SQL included in `/workspaces/telegram-payment-gateway/database/migrations/016_add_auth_tables.sql` for an implementation reference.

**API Contracts (summary)**
- `POST /api/v1/auth/magic-link` — request a magic link (body: `{ email }`). Responds 202 Accepted. Rate-limited.
- `POST /api/v1/auth/magic-link/verify` — verify token (body: `{ token }`) or via query param with GET redirect. Returns 200 with session cookie set or 206 if TOTP required.
- `POST /api/v1/auth/totp/verify` — verify a TOTP code for a pending session token. Returns 200 and sets session cookie.
- `POST /api/v1/auth/totp/enable` — issues a provisioning secret (QR data) after re-auth. Stores encrypted secret when user confirms.
- `POST /api/v1/auth/backup-codes/generate` — generate backup codes; one-time display only.
- `POST /api/v1/auth/logout` — revoke session.

Full endpoint request/response shapes, headers, examples, and failure modes are in the API spec: `/workspaces/telegram-payment-gateway/docs/guides/passwordless-2fa-api.md`.

**Session Management & Cookies**
- Sessions are tracked server-side with a `session_id` stored in an `HttpOnly` cookie. The cookie lifetime is short (e.g., 24 hours) with optional refresh token stored server-side for longer-lived sessions.
- To revoke access (e.g., compromised email), revoke the session record or mark it `revoked_at`. The server checks `revoked_at` at each request.
- Include `last_seen_at` for session activity and idle timeouts.

**TOTP Provisioning & Backup Codes**
- Use RFC 6238 TOTP (e.g., `otpauth://` URI). Generate a 160-bit random secret, store encrypted in `totp_secrets` and only persist when user confirms provisioning.
- Provide QR code data (`otpauth://`) for the authenticator app. Confirm by verifying a code via `POST /api/v1/auth/totp/enable`.
- Provide 10 single-use backup codes (random 10-character codes), hash them with bcrypt/argon2 before saving.

**UX Considerations**
- Magic links should be clear about 1) expiry time and 2) single-use nature.
- For enterprise/internal installs, allow displaying one-time numeric codes in-app when email is not desired (internal-only). Mark this behavior clearly in environment config.
- If TOTP is enabled, the login flow becomes two-step: magic link → TOTP code. The UI must show intermediate state and not leak session tokens in URLs.

**Operational & Monitoring**
- Metrics to collect:
  - Magic link requests per minute, per email, per IP
  - Magic link verification success/failure rates
  - TOTP enable/disable events
  - Session creation/revocation counts
  - Auth-related errors and suspicious rates (spikes in failed verification)
- Alerts:
  - Sudden spike in magic link requests for multiple emails from same IP
  - Repeated failed token verification attempts for the same email

**Testing Checklist**
- Unit tests for token signing/verification and `magic_links` single-use enforcement.
- Integration tests for full login flow (request link, verify, create session, access protected route).
- Tests for TOTP provisioning/verification, backup code usage, and secret encryption/decryption.
- Rate-limiting tests to ensure thresholds are enforced.

**Rollout Plan (can be feature-flagged)**
1. Add DB migrations and deploy schema changes (no behavior change yet).
2. Deploy backend endpoints behind a feature flag; do not enable for users.
3. Deploy frontend opt-in UI behind the same feature flag.
4. Run internal pilot with a small set of admin users.
5. Monitor metrics for anomalies for 72 hours.
6. Gradual rollout to wider user base (10% → 50% → 100%) with monitoring at each step.
7. After full rollout, deprecate legacy login if any, or keep API keys unchanged for programmatic access.

**Roll-back & Safety**
- Rollback is safe by disabling the feature flag (no DB rollback needed). If a migration added columns only, it is non-destructive. For destructive migrations, follow standard backup & rollback practices.

**Developer Notes**
- Use a dedicated encryption key (KMS or `WALLET_ENCRYPTION_KEY`) for TOTP secrets. Rotate keys following the repo's secret rotation procedures.
- Keep auth-related logs in `auth_audit` and avoid logging sensitive tokens or secrets.

**Next Steps**
- Implement `AuthService` in `packages/api` and `packages/core` (stateless handlers as per repository patterns).
- Add DB migrations and run in the test environment; verify with integration tests.
- Implement frontend flows in `packages/dashboard` behind a feature flag.

---
For full API details and example requests/responses, see `/workspaces/telegram-payment-gateway/docs/guides/passwordless-2fa-api.md`.
