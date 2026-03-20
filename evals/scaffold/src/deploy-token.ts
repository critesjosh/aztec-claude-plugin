import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { createLogger } from "@aztec/foundation/log";

const NODE_URL = process.env.AZTEC_NODE_URL ?? "http://localhost:8080";
const DEPLOY_TIMEOUT = 120_000; // 2 minutes for local network

const logger = createLogger("aztec:deploy-token");

async function main() {
  // --- Connect to local node ---
  logger.info(`Connecting to Aztec node at ${NODE_URL}...`);
  const node = createAztecNodeClient(NODE_URL);

  // --- Set up embedded wallet (local, no proving) ---
  logger.info("Creating embedded wallet...");
  const wallet = await EmbeddedWallet.create(node, {
    ephemeral: true,
    pxeConfig: { proverEnabled: false },
  });

  // --- Configure fee payment via SponsoredFPC ---
  logger.info("Configuring sponsored fee payment...");
  const sponsoredFPC = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: new Fr(SPONSORED_FPC_SALT) }
  );
  await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
  const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
  logger.info(`Sponsored FPC at: ${sponsoredFPC.address}`);

  // --- Deploy a Schnorr account to act as token admin ---
  logger.info("Creating Schnorr account...");
  const secretKey = Fr.random();
  const signingKey = GrumpkinScalar.random();
  const salt = Fr.random();
  const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
  logger.info(`Account address: ${account.address}`);

  logger.info("Deploying account contract...");
  const accountDeploy = await account.getDeployMethod();
  await accountDeploy.simulate({ from: AztecAddress.ZERO });
  await accountDeploy.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod },
    wait: { timeout: DEPLOY_TIMEOUT },
  });
  const adminAddress = account.address;
  logger.info(`Account deployed at: ${adminAddress}`);

  // --- Deploy the Token contract ---
  const TOKEN_NAME = "My Token";
  const TOKEN_SYMBOL = "MTK";
  const TOKEN_DECIMALS = 18;

  logger.info(`Deploying Token contract (${TOKEN_SYMBOL})...`);
  const tokenDeploy = TokenContract.deploy(
    wallet,
    adminAddress,
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_DECIMALS
  );

  // Simulate first to surface revert reasons before paying fees
  await tokenDeploy.simulate({ from: adminAddress });
  logger.info("Simulation passed — sending deployment transaction...");

  const { receipt } = await tokenDeploy.send({
    from: adminAddress,
    fee: { paymentMethod },
    wait: { timeout: DEPLOY_TIMEOUT, returnReceipt: true },
  });

  const token = receipt.contract;
  logger.info(`Token contract deployed at: ${token.address}`);
  logger.info(`Admin: ${adminAddress}`);
  logger.info(`Name: ${TOKEN_NAME}  Symbol: ${TOKEN_SYMBOL}  Decimals: ${TOKEN_DECIMALS}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Deployment failed: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  });
