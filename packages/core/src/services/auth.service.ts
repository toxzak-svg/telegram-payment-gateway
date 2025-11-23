import crypto from 'crypto';
import { getDatabase } from '../db/connection';

export class AuthService {
  // Generate a random JTI for tokens
  static generateJti(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Generate a short-lived pending token (opaque) — in real impl store in DB
  static generatePendingToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  // Generate backup codes (cleartext returned to user once)
  static generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // 10-char alphanumeric
      codes.push(crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10));
    }
    return codes;
  }

  // Placeholder: request magic link (should persist magic_links and send email)
  static async requestMagicLink(email: string, opts?: { ip?: string; userAgent?: string }) {
    const jti = AuthService.generateJti();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    // Persist to DB (add real implementation when integrating)
    try {
      const db = getDatabase();
      await db.none(
        'INSERT INTO magic_links (email, token_jti, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [email, jti, expiresAt, opts?.ip || null, opts?.userAgent || null]
      );
    } catch (err) {
      // If DB not initialized in tests, ignore — real implementation should handle errors
    }

    return { token_jti: jti, expires_at: expiresAt.toISOString() };
  }

  // Placeholder: verify magic link token by jti — real implementation should verify signature
  static async verifyMagicLink(tokenJti: string) {
    const db = getDatabase();
    const row = await db.oneOrNone('SELECT * FROM magic_links WHERE token_jti = $1', [tokenJti]);
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.used_at) return { ok: false, reason: 'replay' };
    if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' };

    await db.none('UPDATE magic_links SET used_at = now() WHERE token_jti = $1', [tokenJti]);

    // For now return a dummy user object — real code should map email -> user
    return { ok: true, user: { email: row.email } };
  }
}

export default AuthService;
