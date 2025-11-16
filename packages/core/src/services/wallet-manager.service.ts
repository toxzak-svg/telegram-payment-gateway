import { initDatabase, getDatabase, Database } from '../db/connection';
import TonPaymentService from './ton-payment.service';
import EncryptionUtil from '../utils/encryption.util';

export interface DepositInfo {
  depositId: string;
  address: string;
  expectedAmount: number;
  expiresAt: Date;
  paymentLink: string;
}

export class WalletManagerService {
  private db: Database;
  private tonService: TonPaymentService;
  private encryption: EncryptionUtil;

  constructor() {
    const conn = process.env.DATABASE_URL || '';
    if (!conn) throw new Error('DATABASE_URL is required');
    this.db = initDatabase(conn);

    this.tonService = new TonPaymentService({
      endpoint: process.env.TON_API_ENDPOINT || '',
      apiKey: process.env.TON_API_KEY,
      mnemonic: process.env.TON_WALLET_MNEMONIC || ''
    });

    this.encryption = new EncryptionUtil(process.env.WALLET_ENCRYPTION_KEY || '');
  }

  /**
   * Create or reuse a custody wallet and return deposit info
   */
  async createDepositAddress(userId: string, paymentId: string, expectedAmount: number): Promise<DepositInfo> {
    // Ensure TON wallet initialized
    await this.tonService.initializeWallet();
    const address = this.tonService.getWalletAddress();

    // Upsert wallet record (simple SQL)
    const existing = await this.db.oneOrNone('SELECT * FROM wallets WHERE wallet_address = $1', [address]);
    let walletId: string;
    if (!existing) {
      const encrypted = this.encryption.encrypt(process.env.TON_WALLET_MNEMONIC || '');
      const res = await this.db.one(
        `INSERT INTO wallets (user_id, wallet_address, wallet_type, public_key, encrypted_private_key, balance_ton, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,0,true,NOW(),NOW()) RETURNING id`,
        [userId, address, 'custody', '', encrypted]
      );
      walletId = res.id;
    } else {
      walletId = existing.id;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const deposit = await this.db.one(
      `INSERT INTO manual_deposits (user_id, wallet_id, payment_id, expected_amount_ton, deposit_address, status, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,NOW()) RETURNING id`,
      [userId, walletId, paymentId, expectedAmount, address, expiresAt]
    );

    const paymentLink = this.tonService.getWalletAddress();

    // Start simple polling monitor (non-blocking)
    this.startDepositPoll(deposit.id, address, expectedAmount);

    return {
      depositId: deposit.id,
      address,
      expectedAmount,
      expiresAt,
      paymentLink,
    };
  }

  private async startDepositPoll(depositId: string, address: string, expectedAmount: number) {
    // Poll every 30s for matching payments
    const interval = setInterval(async () => {
      try {
        const found = await this.tonService.checkIncomingPayments(expectedAmount);
        if (found) {
          // Update deposit record to awaiting_confirmation
          await this.db.none('UPDATE manual_deposits SET status = $1, received_amount_ton = $2, confirmed_at = NOW() WHERE id = $3', ['awaiting_confirmation', expectedAmount, depositId]);
          clearInterval(interval);
        }
        // Expire if past deadline
        const dep: any = await this.db.oneOrNone('SELECT * FROM manual_deposits WHERE id = $1', [depositId]);
        if (dep && new Date(dep.expires_at) < new Date()) {
          await this.db.none('UPDATE manual_deposits SET status = $1 WHERE id = $2', ['expired', depositId]);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error monitoring deposit:', err);
      }
    }, 30000);
  }
}

export default WalletManagerService;
