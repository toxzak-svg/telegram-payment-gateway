import { initDatabase, Database } from '../db/connection';
import TonBlockchainService, { WalletInfo } from './ton-blockchain.service';
import EncryptionUtil from '../utils/encryption.util';

export interface DepositInfo {
  depositId: string;
  address: string;
  expectedAmount: number;
  expiresAt: Date;
  paymentLink: string;
  minConfirmations: number;
}

export class WalletManagerService {
  private db: Database;
  private tonService: TonBlockchainService;
  private encryption: EncryptionUtil;
  private walletInfo?: WalletInfo;
  private mnemonic: string;

  constructor(options: {
    db?: Database;
    tonService?: TonBlockchainService;
    encryption?: EncryptionUtil;
    mnemonic?: string;
  } = {}) {
    this.db = options.db ?? this.initDbFromEnv();
    this.mnemonic = options.mnemonic ?? (process.env.TON_WALLET_MNEMONIC || '');
    if (!this.mnemonic) {
      throw new Error('TON_WALLET_MNEMONIC is required for wallet management');
    }

    this.tonService = options.tonService ?? this.initTonServiceFromEnv(this.mnemonic);
    this.encryption = options.encryption ?? this.initEncryptionFromEnv();
  }

  private initDbFromEnv(): Database {
    const conn = process.env.DATABASE_URL;
    if (!conn) throw new Error('DATABASE_URL is required');
    return initDatabase(conn);
  }

  private initTonServiceFromEnv(mnemonic: string): TonBlockchainService {
    const endpoint = process.env.TON_API_URL || process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
    return new TonBlockchainService(endpoint, process.env.TON_API_KEY, mnemonic);
  }

  private initEncryptionFromEnv(): EncryptionUtil {
    const key = process.env.WALLET_ENCRYPTION_KEY || '';
    return new EncryptionUtil(key);
  }

  private async ensureWallet(): Promise<WalletInfo> {
    if (!this.walletInfo) {
      this.walletInfo = await this.tonService.initializeWallet();
    }
    return this.walletInfo;
  }

  /**
   * Create or reuse a custody wallet and return deposit info
   */
  async createDepositAddress(userId: string, paymentId: string, expectedAmount: number): Promise<DepositInfo> {
    const walletInfo = await this.ensureWallet();
    const address = walletInfo.address;

    // Upsert wallet record (simple SQL)
    const existing = await this.db.oneOrNone('SELECT * FROM wallets WHERE wallet_address = $1', [address]);
    let walletId: string;
    if (!existing) {
      const encrypted = this.encryption.encrypt(this.mnemonic);
      const res = await this.db.one(
        `INSERT INTO wallets (user_id, wallet_address, wallet_type, public_key, encrypted_private_key, balance_ton, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,0,true,NOW(),NOW()) RETURNING id`,
        [userId, address, 'custody', walletInfo.publicKey, encrypted]
      );
      walletId = res.id;
    } else {
      walletId = existing.id;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const minConfirmations = Number(process.env.TON_MIN_CONFIRMATIONS || 1);

    const deposit = await this.db.one(
      `INSERT INTO manual_deposits (user_id, wallet_id, payment_id, expected_amount_ton, deposit_address, status, expires_at, min_confirmations, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,NOW()) RETURNING id`,
      [userId, walletId, paymentId, expectedAmount, address, expiresAt, minConfirmations]
    );

    const paymentLink = this.tonService.generatePaymentLink(address, expectedAmount);

    console.log('💳 Deposit created, awaiting TON transfer', {
      paymentId,
      depositId: deposit.id,
      address,
      expectedAmount,
      minConfirmations,
    });

    return {
      depositId: deposit.id,
      address,
      expectedAmount,
      expiresAt,
      paymentLink,
      minConfirmations,
    };
  }
}

export default WalletManagerService;
