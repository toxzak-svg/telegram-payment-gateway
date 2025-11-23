import AuthService from '../services/auth.service';

describe('AuthService helpers', () => {
  test('generateJti produces hex string of length 32', () => {
    const jti = AuthService.generateJti();
    expect(typeof jti).toBe('string');
    expect(jti.length).toBe(32);
  });

  test('generateBackupCodes produces requested count and unique codes', () => {
    const codes = AuthService.generateBackupCodes(6);
    expect(codes).toHaveLength(6);
    const unique = new Set(codes);
    expect(unique.size).toBe(6);
    codes.forEach((c) => expect(c.length).toBeGreaterThanOrEqual(6));
  });
});
