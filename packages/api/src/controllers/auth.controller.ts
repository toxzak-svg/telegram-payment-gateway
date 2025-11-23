import { Request, Response } from 'express';
import { AuthService } from '@tg-payment/core';

const FEATURE_FLAG = process.env.FEATURE_PASSWORDLESS_AUTH === 'true';

export default class AuthController {
  static async requestMagicLink(req: Request, res: Response) {
    if (!FEATURE_FLAG) return res.status(404).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'Passwordless auth is disabled' } });

    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: { code: 'MISSING_EMAIL', message: 'Email is required' } });

    try {
      const result = await AuthService.requestMagicLink(email, { ip: req.ip, userAgent: req.get('User-Agent') || undefined });
      // In production, send email via SMTP provider. Here we return 202.
      res.status(202).json({ success: true, data: { message: 'Magic link issued', token_jti: result.token_jti, expires_at: result.expires_at } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to issue magic link' } });
    }
  }

  static async verifyMagicLink(req: Request, res: Response) {
    if (!FEATURE_FLAG) return res.status(404).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'Passwordless auth is disabled' } });

    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Token is required' } });

    try {
      const result = await AuthService.verifyMagicLink(token);
      if (!result.ok) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: result.reason } });
      }

      // Create session cookie (placeholder) — real implementation should create session record and secure cookie
      res.cookie('session_id', AuthService.generatePendingToken(), { httpOnly: true, secure: true, sameSite: 'strict' });
      res.status(200).json({ success: true, data: { user: result.user } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Verification failed' } });
    }
  }

  static async totpVerify(req: Request, res: Response) {
    if (!FEATURE_FLAG) return res.status(404).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'Passwordless auth is disabled' } });

    // Placeholder: real implementation verifies pending token and TOTP code
    const { pending_token, code } = req.body;
    if (!pending_token || !code) return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'pending_token and code are required' } });

    // For now accept any code of length 6 (testing skeleton)
    if (String(code).length !== 6) return res.status(401).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid TOTP code' } });

    res.cookie('session_id', AuthService.generatePendingToken(), { httpOnly: true, secure: true, sameSite: 'strict' });
    res.status(200).json({ success: true, data: { message: 'TOTP verified' } });
  }

  static async enableTotp(req: Request, res: Response) {
    if (!FEATURE_FLAG) return res.status(404).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'Passwordless auth is disabled' } });

    // Return provisioning data (secret + otpauth). Don't persist until user confirms.
    const secret = AuthService.generatePendingToken();
    const otpauth = `otpauth://totp/TG-Payment:${encodeURIComponent(req.body.email || 'user')}?secret=${secret}&issuer=TG-Payment`;
    res.status(200).json({ success: true, data: { secret, otpauth } });
  }

  static async logout(req: Request, res: Response) {
    // Revoke session cookie
    res.clearCookie('session_id');
    res.status(200).json({ success: true });
  }
}
