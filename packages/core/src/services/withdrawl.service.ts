export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface Withdrawal {
  id: string;
  userId: string;
  settlementId: string;
  amount: number;
  currency: string;
  walletAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class WithdrawalService {
  validateWalletAddress(address: string, currency: string): boolean {
    if (!address || address.length < 20) {
      throw new ValidationError('Invalid wallet address');
    }

    if (currency === 'TON') {
      if (!address.match(/^[Uk]Q[A-Za-z0-9_-]{46}$/)) {
        throw new ValidationError('Invalid TON wallet address format');
      }
    } else if (currency === 'USDT') {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError('Invalid Ethereum wallet address format');
      }
    }

    return true;
  }

  async createWithdrawal(
    userId: string,
    settlementId: string,
    amount: number,
    currency: string,
    walletAddress: string
  ): Promise<Withdrawal> {
    if (amount <= 0) {
      throw new ValidationError('Withdrawal amount must be positive');
    }

    this.validateWalletAddress(walletAddress, currency);

    const withdrawal: Withdrawal = {
      id: `withdraw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      settlementId,
      amount,
      currency,
      walletAddress,
      status: 'pending',
      createdAt: new Date(),
    };

    return withdrawal;
  }

  async processWithdrawal(withdrawal: Withdrawal): Promise<Withdrawal> {
    if (withdrawal.status !== 'pending') {
      throw new ValidationError(`Cannot process ${withdrawal.status} withdrawal`);
    }

    const txHash = `0x${Math.random().toString(16).substr(2)}${Math.random().toString(16).substr(2)}`;

    const processed: Withdrawal = {
      ...withdrawal,
      status: 'completed',
      txHash,
      completedAt: new Date(),
    };

    return processed;
  }

  async retryWithdrawal(withdrawal: Withdrawal): Promise<Withdrawal> {
    if (withdrawal.status !== 'failed') {
      throw new ValidationError('Can only retry failed withdrawals');
    }

    return {
      ...withdrawal,
      status: 'pending',
      failureReason: undefined,
    };
  }

  async cancelWithdrawal(withdrawal: Withdrawal, reason: string): Promise<Withdrawal> {
    if (withdrawal.status === 'completed') {
      throw new ValidationError('Cannot cancel completed withdrawal');
    }

    return {
      ...withdrawal,
      status: 'failed',
      failureReason: reason,
    };
  }

  getWithdrawalFee(amount: number, currency: string): number {
    if (currency === 'TON') {
      return amount > 50000 ? 1 : 0.5;
    } else if (currency === 'USDT') {
      return 2;
    }
    return 1;
  }
}
