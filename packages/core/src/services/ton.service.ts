import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";

export class TonBlockchainService {
  private client: TonClient;
  
  constructor() {
    this.client = new TonClient({
      endpoint: process.env.TON_API_URL!,
      apiKey: process.env.TON_API_KEY,
    });
  }

  getClient(): TonClient {
    return this.client;
  }

  async getWallet() {
    const mnemonics = process.env.TON_WALLET_MNEMONIC!.split(" ");
    const keyPair = await mnemonicToWalletKey(mnemonics);
    return WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
  }

  async getSender() {
    const wallet = await this.getWallet();
    const keyPair = await mnemonicToWalletKey(process.env.TON_WALLET_MNEMONIC!.split(" "));
    const walletContract = this.client.open(wallet);
    return walletContract.sender(keyPair.secretKey);
  }
}