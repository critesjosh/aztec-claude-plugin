import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SPONSORED_FPC_SALT } from "@aztec/constants";

const NODE_URL = process.env.AZTEC_NODE_URL ?? "http://localhost:8080";
const DEPLOY_TIMEOUT = 120_000; // 2 minutes for local network

async function main() {
    const logger: Logger = createLogger("aztec:deploy-token");

    // 1. Connect to the local Aztec node
    logger.info(`Connecting to Aztec node at ${NODE_URL}...`);
    const node = createAztecNodeClient(NODE_URL);

    // 2. Create an ephemeral embedded wallet (holds the PXE)
    logger.info("Creating embedded wallet...");
    const wallet = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxeConfig: { proverEnabled: false }, // prover disabled for local network
    });

    // 3. Set up sponsored fee payment (free on local/devnet)
    logger.info("Setting up sponsored fee payment...");
    const sponsoredFPC = await getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact,
        { salt: new Fr(SPONSORED_FPC_SALT) },
    );
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info(`Sponsored FPC at: ${sponsoredFPC.address}`);

    // 4. Generate and deploy a Schnorr account
    logger.info("Deploying Schnorr account...");
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();
    logger.info(`SECRET_KEY=${secretKey}  (save this to recover the account)`);
    logger.info(`SIGNING_KEY=${signingKey}  (save this to recover the account)`);
    logger.info(`SALT=${salt}  (save this to recover the account)`);

    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    const adminAddress = account.address;
    logger.info(`Account address: ${adminAddress}`);

    const accountDeploy = await account.getDeployMethod();
    await accountDeploy.simulate({ from: AztecAddress.ZERO });
    await accountDeploy.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: DEPLOY_TIMEOUT },
    });
    logger.info("Account deployed successfully.");

    // 5. Deploy the Token contract
    //    constructor: (admin: AztecAddress, name: str, symbol: str, decimals: u8)
    const TOKEN_NAME = "My Token";
    const TOKEN_SYMBOL = "MTK";
    const TOKEN_DECIMALS = 18;

    logger.info(`Deploying Token contract (${TOKEN_SYMBOL})...`);
    const deployRequest = TokenContract.deploy(
        wallet,
        adminAddress,
        TOKEN_NAME,
        TOKEN_SYMBOL,
        TOKEN_DECIMALS,
    );

    // Always simulate before send — surfaces revert reasons instantly
    await deployRequest.simulate({ from: adminAddress });
    logger.info("Simulation passed. Sending deployment transaction...");

    const { receipt } = await deployRequest.send({
        from: adminAddress,
        fee: { paymentMethod },
        wait: { timeout: DEPLOY_TIMEOUT, returnReceipt: true },
    });

    const token = receipt.contract;
    logger.info(`Token contract deployed at: ${token.address}`);

    // 6. Verify — read back the token name
    const nameResult = await token.methods.public_get_name().simulate({ from: adminAddress });
    logger.info(`Verified token name: ${nameResult}`);

    logger.info("Deployment complete.");
    logger.info(`  Contract address : ${token.address}`);
    logger.info(`  Admin address    : ${adminAddress}`);
    logger.info(`  Name / Symbol    : ${TOKEN_NAME} / ${TOKEN_SYMBOL}`);
}

main()
    .then(() => process.exit(0))
    .catch((err: Error) => {
        const logger = createLogger("aztec:deploy-token");
        logger.error(`Deployment failed: ${err.message}`);
        logger.error(err.stack ?? "");
        process.exit(1);
    });
