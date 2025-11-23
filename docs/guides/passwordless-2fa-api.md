# Passwordless Auth — API Spec

This file documents the HTTP endpoints for the passwordless magic-link flow, sessions, and optional TOTP 2FA. All endpoints are under `/api/v1/auth`.

General notes
- All endpoints return a standardized API response on error: `{ success: false, error: { code, message } }`.
- Success responses return `{ success: true, data: ... }` unless documented otherwise.
- All time values are UTC.

Security & Headers
- Cookies: session cookie is `session_id` with `HttpOnly; Secure; SameSite=Strict`.
- All POST endpoints should check `Content-Type: application/json`.
- Rate-limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

Endpoints

1) Request Magic Link
- Path: `POST /api/v1/auth/magic-link`
- Purpose: Issue a single-use magic link token and send via email.
- Request body: `{ "email": "user@example.com" }`
- Response: `202 Accepted` and `{ success: true, data: { message: 'Magic link sent' } }`.
- Errors: 429 Too Many Requests, 400 Bad Request for invalid email.

2) Verify Magic Link (token-based verify)
- Path: `POST /api/v1/auth/magic-link/verify`
- Purpose: Verify magic link token and create session.
- Request body: `{ "token": "<token-jws-or-opaque>" }`
- Success:
  - If user has NO TOTP: 200 OK, sets `session_id` cookie and returns `{ success: true, data: { user, session: { id, expires_at } } }`.
  - If user HAS TOTP: 206 Partial Content and `{ success: true, data: { two_factor_required: true, pending_token: "<opaque-temp-token>" } }`.
- Token verification steps:
  - Verify signature and `exp`/`aud` claims.
  - Lookup `magic_links` by `jti/token_jti` and ensure `used_at` is null and `expires_at` not passed.
  - Mark `used_at` when consuming to prevent replay.

3) TOTP Verify for pending token
- Path: `POST /api/v1/auth/totp/verify`
- Purpose: Given a `pending_token` from step 2, verify TOTP code and finish auth.
- Request body: `{ "pending_token": "...", "code": "123456" }`
- Success: 200 OK, sets `session_id` cookie and returns `{ success: true, data: { user, session } }`.
- Errors: 401 Unauthorized for wrong code, 410 Gone for expired pending token.

4) TOTP Enable (provisioning)
- Path: `POST /api/v1/auth/totp/enable`
- Auth: User must be authenticated (session cookie).
- Purpose: Start TOTP provisioning. The server returns `otpauth` URI and `qr_data`.
- Request flow:
  - `GET /api/v1/auth/totp/enable` -> returns `{ secret: <base32>, otpauth: "otpauth://...", qr_data: "data:image/png;base64,..." }` but do not yet persist secret.
  - Frontend shows QR & asks user to confirm by entering a code from their app.
  - `POST /api/v1/auth/totp/enable` body `{ code: '123456', secret_proof: '<temp-proof>' }` -> verify then persist encrypted secret.

5) Backup Codes
- Path: `POST /api/v1/auth/backup-codes/generate`
- Purpose: Generate new backup codes (display once). Returns `{ codes: [ 'abcd-1234', ... ] }` and saves hashed codes server-side.

6) Logout / Revoke
- Path: `POST /api/v1/auth/logout`
- Purpose: Revoke current session (`session_id`) server-side and clear cookie.
- Response: 200 OK `{ success: true }`.

7) Optional: Refresh Session
- Path: `POST /api/v1/auth/session/refresh`
- Purpose: Rotate refresh token and issue new session cookie. Use opaque refresh tokens stored server-side for rotation.

Error handling and status codes
- 400: invalid input
- 401: unauthorized (wrong credentials or TOTP code)
- 403: forbidden (user disabled, blocked)
- 404: not found (magic link not found)
- 410: expired (pending token expired)
- 429: rate-limited

Example: Request Magic Link
```
POST /api/v1/auth/magic-link
Content-Type: application/json

{ "email": "admin@example.com" }
```

Example: Verify Magic Link (success, no TOTP)
```
POST /api/v1/auth/magic-link/verify
Content-Type: application/json

{ "token": "eyJhbGci..." }

HTTP/1.1 200 OK
Set-Cookie: session_id=<opaque>; HttpOnly; Secure; SameSite=Strict
{
  "success": true,
  "data": { "user": { "id": "u_123" }, "session": { "id": "s_123", "expires_at": "..." } }
}
```

Notes
- Always persist `magic_links` usage to prevent replay even if tokens are signed.
- Ensure `pending_token` used between magic link verify and TOTP verify is short-lived (e.g., 5 minutes) and stored in DB with single-use enforcement.
