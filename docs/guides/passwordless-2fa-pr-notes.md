# PR Notes — Passwordless + TOTP Docs & Migration

PR title (suggested):
```
docs(auth): add passwordless + optional TOTP 2FA design docs and auth table migration
```

Summary
- Adds comprehensive design docs for a passwordless authentication system with optional TOTP 2FA and an additive DB migration to support `magic_links`, `sessions`, `totp_secrets`, `backup_codes`, and `auth_audit`.
- Files added:
  - `docs/guides/passwordless-2fa.md` (design, threat model, flows)
  - `docs/guides/passwordless-2fa-api.md` (endpoint spec & examples)
  - `docs/guides/passwordless-2fa-rollout.md` (rollout & testing checklist)
  - `database/migrations/016_add_auth_tables.sql` (additive migration)

Why
- Prepare the codebase with standard, reviewed docs and a safe migration to enable implementing passwordless login and optional 2FA with controlled rollout.

Testing done
- Created docs and migration only. No runtime code changes were made in this PR.
- Suggested test steps for reviewers (manual):
  1. Review migration SQL for obvious issues (types, constraints, indexes).
  2. Run the migration locally against a test DB and ensure `psql` reports success:
     - `psql "$DATABASE_URL" -f database/migrations/016_add_auth_tables.sql`
  3. Review docs for clarity and completeness.

Deployment notes
- Migration is additive. Apply during a standard deploy window. No immediate code dependency—auth endpoints will be feature-flagged when implemented.
- Ensure environment variables are provisioned before enabling the feature flag in production: `WALLET_ENCRYPTION_KEY` (or KMS), `EMAIL_SMTP`.

Security & Risk
- This change only adds documentation and DB schema. The schema contains fields that will store encrypted secrets and hashed backup codes. Implementors must follow the encryption/hashing guidance in the docs.

Reviewer checklist
- [ ] Confirm migration SQL is additive and idempotent.
- [ ] Confirm no sensitive plaintext secrets are committed to the repo.
- [ ] Read the threat model and confirm mitigation strategies are adequate.
- [ ] Approve rollout and monitoring steps or suggest improvements.

Suggested commit message
```
docs(auth): add passwordless + totp design docs; add migration 016_add_auth_tables.sql

- Adds design guide, API spec, rollout checklist for passwordless + optional TOTP 2FA
- Adds additive DB migration to create `magic_links`, `sessions`, `totp_secrets`, `backup_codes`, `auth_audit`

This PR is documentation + schema only. No runtime auth behavior is enabled.
```

Quick commands for reviewers
```
# Apply migration against DEV (example)
psql "$DATABASE_URL" -f database/migrations/016_add_auth_tables.sql

# Run docs spellcheck (if available)
npx remark-cli "docs/**/*.md"
```

Next steps after merge
- Implement backend `AuthService` and controllers behind `FEATURE_PASSWORDLESS_AUTH` flag.
- Implement frontend opt-in login UI and TOTP provisioning behind the same flag.
- Add integration tests and enable CI matrices for auth flows.
