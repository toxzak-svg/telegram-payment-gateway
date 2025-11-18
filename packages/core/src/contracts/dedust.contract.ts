import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export interface DeDustPoolConfig {
  poolAddress: Address;
  token0: Address;
  token1: Address;
  fee: number;
}

export interface SwapParams {
  amountIn: bigint;
  minAmountOut: bigint;
  deadline: number;
  recipient: Address;
}

export interface PoolData {
  reserve0: bigint;
  reserve1: bigint;
  token0: Address;
  token1: Address;
  lpFee: number;
  protocolFee: number;
}

/**
 * DeDust V2 Pool Contract
 * Handles direct swaps through liquidity pools on TON blockchain
 */
export class DeDustPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new DeDustPool(address);
  }

  /**
   * Get pool data including reserves and fees
   */
  async getPoolData(provider: ContractProvider): Promise<PoolData> {
    const result = await provider.get('get_pool_data', []);
    return {
      reserve0: result.stack.readBigNumber(),
      reserve1: result.stack.readBigNumber(),
      token0: result.stack.readAddress(),
      token1: result.stack.readAddress(),
      lpFee: result.stack.readNumber(),
      protocolFee: result.stack.readNumber(),
    };
  }

  /**
   * Send swap transaction to the pool
   * @param provider Contract provider
   * @param via Sender (wallet)
   * @param params Swap parameters
   * @param value Total value to send (amount + gas)
   */
  async sendSwap(
    provider: ContractProvider,
    via: Sender,
    params: SwapParams,
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(0x25938561, 32) // swap op code for DeDust
      .storeUint(0, 64) // query id
      .storeCoins(params.amountIn)
      .storeCoins(params.minAmountOut)
      .storeUint(params.deadline, 32)
      .storeAddress(params.recipient)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  /**
   * Calculate expected output amount using constant product formula
   * @param amountIn Input amount
   * @param reserveIn Reserve of input token
   * @param reserveOut Reserve of output token
   * @param fee Total fee (LP + protocol)
   */
  static calculateOutputAmount(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fee: number
  ): bigint {
    // Formula: (amountIn * (1 - fee) * reserveOut) / (reserveIn + amountIn * (1 - fee))
    const feeMultiplier = 10000 - Math.floor(fee * 10000);
    const amountInWithFee = (amountIn * BigInt(feeMultiplier)) / BigInt(10000);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
  }
}

/**
 * DeDust Vault Contract
 * Handles deposits and withdrawals for liquidity provision
 */
export class DeDustVault implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new DeDustVault(address);
  }

  async sendDeposit(
    provider: ContractProvider,
    via: Sender,
    params: {
      poolAddress: Address;
      amount: bigint;
      minLpOut: bigint;
    },
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(0x21eeb607, 32) // deposit op code
      .storeAddress(params.poolAddress)
      .storeCoins(params.amount)
      .storeCoins(params.minLpOut)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}
