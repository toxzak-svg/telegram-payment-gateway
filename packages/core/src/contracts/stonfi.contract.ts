import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export interface StonfiSwapParams {
  amountIn: bigint;
  amountOutMin: bigint;
  path: Address[]; // Token addresses for swap path
  to: Address;
  deadline: number;
}

/**
 * Ston.fi Router Contract
 * Handles multi-hop swaps through Ston.fi DEX on TON blockchain
 */
export class StonfiRouter implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new StonfiRouter(address);
  }

  /**
   * Get expected output amounts for a given input and path
   * @param provider Contract provider
   * @param amountIn Input amount
   * @param path Token swap path
   * @returns Array of expected amounts for each hop
   */
  async getAmountsOut(
    provider: ContractProvider,
    amountIn: bigint,
    path: Address[]
  ): Promise<bigint[]> {
    const pathCell = beginCell();
    path.forEach(addr => pathCell.storeAddress(addr));

    const result = await provider.get('get_amounts_out', [
      { type: 'int', value: amountIn },
      { type: 'cell', cell: pathCell.endCell() },
    ]);

    const amounts: bigint[] = [];
    const tuple = result.stack.readTuple();
    while (tuple.remaining > 0) {
      amounts.push(tuple.readBigNumber());
    }

    return amounts;
  }

  /**
   * Execute swap with exact input amount
   * @param provider Contract provider
   * @param via Sender (wallet)
   * @param params Swap parameters including path
   * @param value Total value to send (amount + gas)
   */
  async sendSwapExactTokensForTokens(
    provider: ContractProvider,
    via: Sender,
    params: StonfiSwapParams,
    value: bigint
  ) {
    // Encode path as cell
    const pathCell = beginCell();
    params.path.forEach(addr => pathCell.storeAddress(addr));

    const messageBody = beginCell()
      .storeUint(0x25938561, 32) // swapExactTokensForTokens op code
      .storeUint(0, 64) // query id
      .storeCoins(params.amountIn)
      .storeCoins(params.amountOutMin)
      .storeRef(pathCell.endCell())
      .storeAddress(params.to)
      .storeUint(params.deadline, 32)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  /**
   * Get pool information for a token pair
   */
  async getPoolInfo(
    provider: ContractProvider,
    token0: Address,
    token1: Address
  ): Promise<{
    reserve0: bigint;
    reserve1: bigint;
    lpSupply: bigint;
  }> {
    const result = await provider.get('get_pool_data', [
      { type: 'slice', cell: beginCell().storeAddress(token0).endCell() },
      { type: 'slice', cell: beginCell().storeAddress(token1).endCell() },
    ]);

    return {
      reserve0: result.stack.readBigNumber(),
      reserve1: result.stack.readBigNumber(),
      lpSupply: result.stack.readBigNumber(),
    };
  }
}
