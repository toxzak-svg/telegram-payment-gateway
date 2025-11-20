import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto";

async function main() {
  // Create a new random mnemonic
  const mnemonics = await mnemonicNew();
  const keyPair = await mnemonicToWalletKey(mnemonics);

  const publicKey = keyPair.publicKey.toString("hex");
  const secretKey = keyPair.secretKey.toString("hex");

  console.log("Mnemonic:", mnemonics.join(" "));
  console.log("Public Key (hex):", publicKey);
  console.log("Secret Key (hex):", secretKey);
  console.log("\n✅ Wallet generated. Please fund it with testnet TON.");
  console.log("Go to a testnet faucet (e.g., on Telegram: @testgiver_ton_bot) to get funds.");
}

main().catch(console.error);