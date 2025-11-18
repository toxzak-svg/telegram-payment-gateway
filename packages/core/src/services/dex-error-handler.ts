export enum DexErrorCode {
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  WALLET_NOT_INITIALIZED = 'WALLET_NOT_INITIALIZED',
  INVALID_TOKEN_ADDRESS = 'INVALID_TOKEN_ADDRESS',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
}

export class DexError extends Error {
  constructor(
    public code: DexErrorCode,
    message: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'DexError';
    Object.setPrototypeOf(this, DexError.prototype);
  }
}

export class DexRetryHandler {
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 5000]; // Exponential backoff in ms

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryableErrors: DexErrorCode[] = [
      DexErrorCode.NETWORK_ERROR,
      DexErrorCode.TRANSACTION_TIMEOUT,
    ]
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (error instanceof DexError && retryableErrors.includes(error.code)) {
          console.log(
            `Retry attempt ${attempt + 1}/${this.maxRetries} for ${error.code}`,
            error.metadata
          );

          if (attempt < this.maxRetries - 1) {
            await this.delay(this.retryDelays[attempt]);
            continue;
          }
        }

        // Non-retryable error or max retries exceeded
        throw error;
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse various error types and convert to DexError
 */
export function parseDexError(error: any): DexError {
  const message = error.message || error.toString();

  if (message.includes('insufficient liquidity') || message.includes('K')) {
    return new DexError(
      DexErrorCode.INSUFFICIENT_LIQUIDITY,
      'Pool has insufficient liquidity for this swap',
      { originalError: message }
    );
  }

  if (message.includes('slippage') || message.includes('min amount') || message.includes('SLIPPAGE')) {
    return new DexError(
      DexErrorCode.SLIPPAGE_EXCEEDED,
      'Price moved beyond slippage tolerance',
      { originalError: message }
    );
  }

  if (message.includes('insufficient funds') || message.includes('balance') || message.includes('not enough')) {
    return new DexError(
      DexErrorCode.INSUFFICIENT_FUNDS,
      'Wallet has insufficient balance for this transaction',
      { originalError: message }
    );
  }

  if (message.includes('reverted') || message.includes('failed') || message.includes('compute phase')) {
    return new DexError(
      DexErrorCode.TRANSACTION_REVERTED,
      'Transaction reverted on blockchain',
      { originalError: message }
    );
  }

  if (message.includes('deadline')) {
    return new DexError(
      DexErrorCode.DEADLINE_EXCEEDED,
      'Transaction deadline exceeded',
      { originalError: message }
    );
  }

  if (message.includes('pool') && message.includes('not found')) {
    return new DexError(
      DexErrorCode.POOL_NOT_FOUND,
      'Liquidity pool not found',
      { originalError: message }
    );
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return new DexError(
      DexErrorCode.TRANSACTION_TIMEOUT,
      'Transaction polling timeout',
      { originalError: message }
    );
  }

  if (message.includes('gas') || message.includes('estimate')) {
    return new DexError(
      DexErrorCode.GAS_ESTIMATION_FAILED,
      'Failed to estimate gas fees',
      { originalError: message }
    );
  }

  if (message.includes('wallet') || message.includes('mnemonic')) {
    return new DexError(
      DexErrorCode.WALLET_NOT_INITIALIZED,
      'Wallet not properly initialized',
      { originalError: message }
    );
  }

  if (message.includes('invalid address') || message.includes('token')) {
    return new DexError(
      DexErrorCode.INVALID_TOKEN_ADDRESS,
      'Invalid token address provided',
      { originalError: message }
    );
  }

  // Default to network error
  return new DexError(
    DexErrorCode.NETWORK_ERROR,
    'Unknown DEX error occurred',
    { originalError: message }
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!(error instanceof DexError)) {
    return false;
  }

  const retryableCodes = [
    DexErrorCode.NETWORK_ERROR,
    DexErrorCode.TRANSACTION_TIMEOUT,
    DexErrorCode.GAS_ESTIMATION_FAILED,
  ];

  return retryableCodes.includes(error.code);
}
