import crypto from 'crypto';

// AES-256-GCM encryption utility for encrypting private keys
export class EncryptionUtil {
  private key: Buffer;

  constructor(hexKey: string) {
    if (!hexKey) throw new Error('Encryption key is required');
    // Expect a 256-bit (32 byte) hex key
    this.key = Buffer.from(hexKey, 'hex');
    if (this.key.length !== 32) {
      throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
    }
  }

  /**
   * Encrypt a UTF-8 string and return base64 payload containing iv:tag:ciphertext
   */
  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Return as base64 of iv|tag|ciphertext
    const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    return payload;
  }

  /**
   * Decrypt payload produced by `encrypt` above
   */
  decrypt(payload: string): string {
    const data = Buffer.from(payload, 'base64');
    if (data.length < 12 + 16) {
      throw new Error('Invalid payload');
    }

    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const ciphertext = data.slice(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

export default EncryptionUtil;
