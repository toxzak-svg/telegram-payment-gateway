import { TonClient, WalletContractV4, internal, fromNano, toNano, Address, Cell } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

export interface WalletInfo {
  address: string;
  publicKey: string;
}

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  confirmed: boolean;
  confirmations: number;
  success?: boolean;
  exitCode?: number;
}

/**
 * TonBlockchainService
 * Direct TON blockchain integration (no Fragment API)
 * Handles wallet creation, monitoring, and transaction verification
 */
export class TonBlockchainService {
  private client: TonClient;
  private wallet: WalletContractV4 | null = null;
  private walletAddress: Address | null = null;
  private keyPair: any = null;
  private activeIntervals?: Set<NodeJS.Timeout>;

  constructor(
    private endpoint: string,
    private apiKey?: string,
    private mnemonic?: string
  ) {
    this.client = new TonClient({
      endpoint,
      apiKey,
    });
  }

  /**
   * Initialize wallet from mnemonic
   */
  async initializeWallet(): Promise<WalletInfo> {
    if (!this.mnemonic) {
      throw new Error('Mnemonic not provided');
    }

    try {
      this.keyPair = await mnemonicToPrivateKey(this.mnemonic.split(' '));

      const workchain = 0;
      this.wallet = WalletContractV4.create({
        workchain,
        publicKey: this.keyPair.publicKey,
      });

      this.walletAddress = this.wallet.address;

      console.log('✅ TON wallet initialized:', this.walletAddress.toString());

      return {
        address: this.walletAddress.toString(),
        publicKey: this.keyPair.publicKey.toString('hex'),
      };
    } catch (error) {
      console.error('❌ Failed to initialize wallet:', error);
      throw error;
    }
  }

  /**
   * Get the underlying TonClient
   */
  getClient(): TonClient {
    return this.client;
  }

  /**
   * Get the initialized wallet contract and key pair
   */
  getWallet(): { wallet: WalletContractV4; keyPair: any } {
    if (!this.wallet || !this.keyPair) {
      throw new Error('Wallet not initialized. Call initializeWallet() first.');
    }
    return { wallet: this.wallet, keyPair: this.keyPair };
  }

  /**
   * Get a sender object for sending transactions
   */
  getSender() {
    if (!this.wallet || !this.keyPair) {
      throw new Error('Wallet not initialized');
    }
    const walletContract = this.client.open(this.wallet);
    return walletContract.sender(this.keyPair.secretKey);
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
   * Get wallet balance in TON
   */
  async getBalance(): Promise<number> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const balance = await this.client.getBalance(this.walletAddress);
      return parseFloat(fromNano(balance));
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Monitor wallet for incoming payments
   */
  async monitorDeposits(
    callback: (tx: TransactionInfo) => Promise<void>,
    intervalMs: number = 30000
  ): Promise<() => void> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    let lastHash: string | null = null;

    const poll = async () => {
      try {
        const transactions = await this.client.getTransactions(
          this.walletAddress!,
          { limit: 10 }
        );

        for (const tx of transactions) {
          const hash = tx.hash().toString('hex');
          
          // Skip if already processed
          if (lastHash && hash === lastHash) {
            continue;
          }

          // Check for incoming message
          if (tx.inMessage && 'info' in tx.inMessage && 'value' in (tx.inMessage.info as any)) {
            const info = (tx.inMessage.info as any);
            if (info.value && 'coins' in info.value) {
              const amount = parseFloat(fromNano(info.value.coins));
              const fromAddr = 'source' in (tx.inMessage as any) 
                ? (tx.inMessage as any).source?.toString() 
                : 'unknown';
              
              const txInfo: TransactionInfo = {
                hash,
                from: fromAddr,
                to: this.walletAddress!.toString(),
                amount,
                timestamp: tx.now || Math.floor(Date.now() / 1000),
                confirmed: true,
                confirmations: 1,
              };

              await callback(txInfo);
            }
          }

          lastHash = hash;
        }
      } catch (error) {
        console.error('❌ Error monitoring deposits:', error);
      }
    };

    // Initial poll
    await poll();

    // Set up recurring polling
    const intervalId = setInterval(poll, intervalMs);

    // Store interval ID for cleanup (prevent memory leak)
    if (!this.activeIntervals) {
      this.activeIntervals = new Set();
    }
    this.activeIntervals.add(intervalId);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      this.activeIntervals?.delete(intervalId);
    };
  }

  /**
   * Send TON to destination address
   */
  async sendTON(
    destinationAddress: string,
    amountTon: number,
    memo?: string
  ): Promise<string> {
    if (!this.wallet || !this.keyPair) {
      throw new Error('Wallet not initialized');
    }

    try {
      const contract = this.client.open(this.wallet);
      const seqno = await contract.getSeqno();

      const result = await contract.sendTransfer({
        seqno,
        secretKey: this.keyPair.secretKey,
        messages: [
          internal({
            to: destinationAddress,
            value: toNano(amountTon.toString()),
            body: memo || '',
            init: null,
          }),
        ],
      });

      console.log('💸 TON transfer sent:', {
        to: destinationAddress,
        amount: amountTon,
        seqno,
      });

      return `seqno-${seqno}`;
    } catch (error) {
      console.error('❌ Failed to send TON:', error);
      throw error;
    }
  }

  /**
   * Verify transaction on blockchain
   */
  async verifyTransaction(
    txHash: string,
    minConfirmations: number = 10
  ): Promise<boolean> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      const transactions = await this.client.getTransactions(
        this.walletAddress,
        { limit: 50 }
      );

      // Search for transaction in list
      for (const tx of transactions) {
        if (tx.hash().toString('hex') === txHash) {
          // Check transaction description for exit code
          const { description } = tx;

          // Verify transaction was successful
          // Only exitCode === 0 indicates success
          if (description && 'type' in description) {
            const desc = description as any;
            if (desc.type === 'generic') {
              const exitCode = desc.computePhase?.exitCode;
              if (exitCode !== undefined && exitCode !== 0) {
                console.warn(`❌ Transaction ${txHash} failed with exit code ${exitCode}`);
                return false;
              }
            }
          }

          // Simplified: verify based on inclusion in transaction list
          // In production, check block height and confirmations
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to verify transaction:', error);
      return false;
    }
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(txHash: string): Promise<TransactionInfo | null> {
    if (!this.walletAddress) {
      throw new Error('Wallet not initialized');
    }

    try {
      // Fetch recent transactions for the wallet
      const transactions = await this.client.getTransactions(this.walletAddress, {
        limit: 50,
      });

      for (const tx of transactions) {
        if (tx.hash().toString('hex') === txHash) {
          let amount = 0;
          let from = '';
          let to = '';

          if (tx.inMessage && tx.inMessage.info.type === 'internal') {
             amount = parseFloat(fromNano(tx.inMessage.info.value.coins));
             from = tx.inMessage.info.src.toString();
             to = tx.inMessage.info.dest.toString();
          }
          
          // Check success status (compute phase exit code)
          let success = true;
          let exitCode = 0;
          
          if (tx.description.type === 'generic') {
             const { computePhase } = tx.description;
             const {computePhase} = tx.description;
             exitCode = computePhase.type === 'vm' ? computePhase.exitCode : 0;
             success = exitCode === 0;
          }

          return {
            hash: txHash,
            from,
            to,
            amount,
            timestamp: tx.now,
            confirmed: true,
            confirmations: 1,
            success,
            exitCode
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Validate TON address format
   */
  isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate payment link for mobile wallets
   */
  generatePaymentLink(address: string, amountTon: number, memo?: string): string {
    const amountNano = Math.floor(amountTon * 1e9);
    let link = `ton://transfer/${address}?amount=${amountNano}`;
    if (memo) {
      link += `&text=${encodeURIComponent(memo)}`;
    }
    return link;
  }
}

export default TonBlockchainService;
