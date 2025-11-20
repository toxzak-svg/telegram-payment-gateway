import { initDatabase, Database } from '../db/connection';
import TonPaymentService from './ton-payment.service';
import EncryptionUtil from '../utils/encryption.util';

export interface DepositInfo {
  depositId: string;
  address: string;
  expectedAmount: number;
  expiresAt: Date;
  paymentLink: string;
  minConfirmations: number;
}

export interface WalletManagerServiceOptions {
  db?: Database;
  databaseUrl?: string;
  tonService?: TonPaymentService;
  encryption?: EncryptionUtil;
  mnemonic?: string;
  tonEndpoint?: string;
  tonApiKey?: string;
  minConfirmations?: number;
}

export class WalletManagerService {
  private db: Database;
  private tonService: TonPaymentService;
  private encryption: EncryptionUtil;
  private mnemonic: string;
  private minConfirmations?: number;
  private walletInitialized = false;

  constructor(options: WalletManagerServiceOptions = {}) {
    if (options.db) {
      this.db = options.db;
    } else {
      const connectionString = options.databaseUrl || process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is required');
      }
      this.db = initDatabase(connectionString);
    }

    this.mnemonic = options.mnemonic || process.env.TON_WALLET_MNEMONIC || '';
    if (!this.mnemonic) {
      throw new Error('TON_WALLET_MNEMONIC is required');
    }

    this.tonService =
      options.tonService ||
      new TonPaymentService({
        endpoint: options.tonEndpoint || process.env.TON_API_ENDPOINT || '',
        apiKey: options.tonApiKey || process.env.TON_API_KEY,
        mnemonic: this.mnemonic,
        workchain: process.env.TON_WORKCHAIN
          ? parseInt(process.env.TON_WORKCHAIN, 10)
          : undefined,
      });

    if (options.encryption) {
      this.encryption = options.encryption;
    } else {
      const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || '';
      this.encryption = new EncryptionUtil(encryptionKey);
    }

    this.minConfirmations = options.minConfirmations;
  }

  /**
   * Create or reuse a custody wallet and return deposit info
   */
  async createDepositAddress(userId: string, paymentId: string, expectedAmount: number): Promise<DepositInfo> {
    // Ensure TON wallet initialized once
    if (!this.walletInitialized) {
      await this.tonService.initializeWallet();
      this.walletInitialized = true;
    }
    const address = this.tonService.getWalletAddress();

    // Upsert wallet record (simple SQL)
    const existing = await this.db.oneOrNone('SELECT * FROM wallets WHERE wallet_address = $1', [address]);
    let walletId: string;
    if (!existing) {
      const encrypted = this.encryption.encrypt(this.mnemonic);
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

    const minConfirmations = this.getMinConfirmations();
    let paymentLink: string;
    try {
      paymentLink = this.tonService.generatePaymentLink(expectedAmount);
    } catch {
      const amountNano = Math.max(Math.floor(expectedAmount * 1e9), 0);
      paymentLink = `ton://transfer/${address}?amount=${amountNano}`;
    }

    // Start simple polling monitor (non-blocking)
    this.startDepositPoll(deposit.id, address, expectedAmount);

    return {
      depositId: deposit.id,
      address,
      expectedAmount,
      expiresAt,
      paymentLink,
      minConfirmations,
    };
  }

  private getMinConfirmations(): number {
    if (typeof this.minConfirmations === 'number') {
      return this.minConfirmations;
    }
    const envValue = process.env.TON_MIN_CONFIRMATIONS;
    const parsed = envValue ? parseInt(envValue, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
          return;
        }
        // Expire if past deadline
        const dep: any = await this.db.oneOrNone('SELECT * FROM manual_deposits WHERE id = $1', [depositId]);
        if (dep && new Date(dep.expires_at) < new Date()) {
          await this.db.none('UPDATE manual_deposits SET status = $1 WHERE id = $2', ['expired', depositId]);
          clearInterval(interval);
          return;
        }
      } catch (err) {
        console.error('Error monitoring deposit:', err);
        // Clear interval on persistent errors to prevent memory leak
        clearInterval(interval);
        // Mark deposit as failed
        await this.db.none('UPDATE manual_deposits SET status = $1 WHERE id = $2', ['failed', depositId]).catch(console.error);
      }
    }, 30000);
  }
}

export default WalletManagerService;
