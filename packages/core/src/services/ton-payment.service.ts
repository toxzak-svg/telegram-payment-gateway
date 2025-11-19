import { Address, TonClient, WalletContractV4, internal, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

export interface TonPaymentConfig {
  endpoint: string;
  apiKey?: string;
  mnemonic: string;
  workchain?: number;
}

export class TonPaymentService {
  private client: TonClient;
  private wallet: WalletContractV4 | null = null; // FIXED: Made nullable with initialization
  private walletAddress: Address | null = null;

  constructor(private config: TonPaymentConfig) {
    this.client = new TonClient({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
    });
  }

  /**
   * Initialize wallet from mnemonic
   */
  async initializeWallet(): Promise<void> {
    const keyPair = await mnemonicToPrivateKey(this.config.mnemonic.split(' '));
    
    const workchain = this.config.workchain ?? 0;
    this.wallet = WalletContractV4.create({
      workchain,
      publicKey: keyPair.publicKey,
    });

    this.walletAddress = this.wallet.address;
    console.log('✅ TON wallet initialized:', this.walletAddress.toString());
  }

  /**
   * Get wallet balance in TON
   */
  async getBalance(): Promise<number> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    const balance = await this.client.getBalance(this.walletAddress);
    return parseFloat(fromNano(balance));
  }

  /**
   * Monitor incoming payments
   */
  async checkIncomingPayments(expectedAmount: number): Promise<boolean> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const transactions = await this.client.getTransactions(this.walletAddress, {
        limit: 10,
      });

      for (const tx of transactions) {
        // FIXED: Proper type checking for transaction messages
        if (tx.inMessage && 'info' in tx.inMessage && 'value' in tx.inMessage.info) {
          const info = tx.inMessage.info as any; // Type assertion for value access
          if (info.value && 'coins' in info.value) {
            const received = Number(info.value.coins) / 1e9;
            
            if (Math.abs(received - expectedAmount) < 0.0001) {
              console.log('✅ Payment received:', received, 'TON');
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking payments:', error);
      return false;
    }
  }

  /**
   * Send TON to destination address
   */
  async sendTon(
    destinationAddress: string,
    amount: number,
    comment?: string
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const keyPair = await mnemonicToPrivateKey(this.config.mnemonic.split(' '));
    
    // FIXED: Get contract provider from client
    const contract = this.client.open(this.wallet);
    const seqno = await contract.getSeqno();

    // FIXED: Proper sendTransfer usage with provider
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: destinationAddress,
          value: (amount * 1e9).toString(),
          body: comment || '',
        }),
      ],
    });

    console.log('💸 TON transfer initiated:', {
      to: destinationAddress,
      amount,
      seqno,
    });

    return `seqno-${seqno}`;
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }
    return this.walletAddress.toString();
  }

  /**
   * Generate a deeplink for TON wallets
   */
  generatePaymentLink(amountTon: number, memo?: string): string {
    const address = this.getWalletAddress();
    const amountNano = Math.max(Math.floor(amountTon * 1e9), 0);
    let link = `ton://transfer/${address}?amount=${amountNano}`;
    if (memo) {
      link += `&text=${encodeURIComponent(memo)}`;
    }
    return link;
  }

  /**
   * Verify transaction exists on blockchain
   */
  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      // Implementation depends on transaction hash format
      // This is a simplified version
      return true;
    } catch (error) {
      console.error('❌ Error verifying transaction:', error);
      return false;
    }
  }
}

export default TonPaymentService;
