import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import 'dotenv/config';

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
  
  if (!apiKey) throw new Error("Missing CIRCLE_API_KEY in .env");
  if (!entitySecret) throw new Error("Missing CIRCLE_ENTITY_SECRET in .env");

  console.log("🔐 Using PERSISTENT Entity Secret from .env");

  // Step 1: Register entity secret (Required for the first time with a new account)
  try {
    await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });
    console.log("✅ Entity secret registered successfully");
  } catch (error: any) {
    if (error.response?.data?.code === 156015 || error.message?.includes('already set')) {
      console.log("ℹ️ Entity secret already registered. Moving to wallet creation...");
    } else {
      console.error("❌ Registration Failed:", error.response?.data?.message || error.message);
      throw error;
    }
  }

  // Step 2: Init client
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // Step 3: Create wallet set
  console.log("🔨 Creating wallet set...");
  const walletSet = await client.createWalletSet({
    name: "SwarmPay-Agent-Set-" + Date.now(),
  });

  const walletSetId = walletSet.data?.walletSet?.id;
  console.log("✅ Wallet Set ID:", walletSetId);

  // Step 4: Create wallet
  console.log("👛 Generating individual wallet on ARC-TESTNET...");
  const walletResponse = await client.createWallets({
    walletSetId: walletSetId!,
    blockchains: ["ARC-TESTNET"],
    count: 1,
  });

  const wallet = walletResponse.data?.wallets?.[0];
  if (!wallet) throw new Error("Wallet creation failed: No wallet returned");
  
  console.log("✅ Wallet created successfully!");
  console.log("📍 Wallet Address:", wallet.address);
  console.log("🔗 Blockchain:", wallet.blockchain);

  console.log("\n👉 Now go fund it:");
  console.log(`https://faucet.circle.com?address=${wallet.address}`);
}

main().catch(console.error);
