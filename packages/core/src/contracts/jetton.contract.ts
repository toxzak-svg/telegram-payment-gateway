import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

// Jetton operation codes
export const JETTON_TRANSFER_OP = 0x0f8a7ea5;
export const JETTON_BURN_OP = 0x595f07bc;

export interface JettonMasterData {
  totalSupply: bigint;
  mintable: boolean;
  adminAddress: Address;
  jettonContent: Cell;
  jettonWalletCode: Cell;
}

export interface JettonWalletData {
  balance: bigint;
  ownerAddress: Address;
  jettonMasterAddress: Address;
  jettonWalletCode: Cell;
}

export interface JettonTransferParams {
  queryId: bigint;
  amount: bigint;
  destination: Address;
  responseDestination: Address;
  customPayload: Cell | null;
  forwardTonAmount: bigint;
  forwardPayload: Cell | null;
}

/**
 * Jetton Master Contract
 * Represents the main Jetton token contract on TON blockchain
 */
export class JettonMaster implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new JettonMaster(address);
  }

  /**
   * Get Jetton master data including total supply and admin
   */
  async getJettonData(provider: ContractProvider): Promise<JettonMasterData> {
    const result = await provider.get('get_jetton_data', []);
    
    return {
      totalSupply: result.stack.readBigNumber(),
      mintable: result.stack.readBoolean(),
      adminAddress: result.stack.readAddress(),
      jettonContent: result.stack.readCell(),
      jettonWalletCode: result.stack.readCell(),
    };
  }

  /**
   * Get wallet address for a specific owner
   * This is critical for discovering the wallet contract address
   */
  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address
  ): Promise<Address> {
    const result = await provider.get('get_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() },
    ]);
    
    return result.stack.readAddress();
  }
}

/**
 * Jetton Wallet Contract
 * Represents an individual user's Jetton token wallet
 */
export class JettonWallet implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new JettonWallet(address);
  }

  /**
   * Get wallet data including balance and owner
   */
  async getWalletData(provider: ContractProvider): Promise<JettonWalletData> {
    const result = await provider.get('get_wallet_data', []);
    
    return {
      balance: result.stack.readBigNumber(),
      ownerAddress: result.stack.readAddress(),
      jettonMasterAddress: result.stack.readAddress(),
      jettonWalletCode: result.stack.readCell(),
    };
  }

  /**
   * Send Jetton transfer transaction
   * This is used to transfer Jettons from the wallet to another address
   */
  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    params: JettonTransferParams,
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(JETTON_TRANSFER_OP, 32) // transfer op code
      .storeUint(params.queryId, 64)
      .storeCoins(params.amount)
      .storeAddress(params.destination)
      .storeAddress(params.responseDestination)
      .storeMaybeRef(params.customPayload)
      .storeCoins(params.forwardTonAmount)
      .storeMaybeRef(params.forwardPayload)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  /**
   * Send burn transaction
   * Burns (destroys) Jettons from the wallet
   */
  async sendBurn(
    provider: ContractProvider,
    via: Sender,
    params: {
      queryId: bigint;
      amount: bigint;
      responseDestination: Address;
    },
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(JETTON_BURN_OP, 32) // burn op code
      .storeUint(params.queryId, 64)
      .storeCoins(params.amount)
      .storeAddress(params.responseDestination)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}


