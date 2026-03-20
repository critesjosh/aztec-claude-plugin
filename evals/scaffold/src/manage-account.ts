import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { Fr } from '@aztec/aztec.js/fields';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createLogger } from '@aztec/aztec.js/log';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const logger = createLogger('aztec:manage-account');
const ENV_FILE = path.resolve(process.cwd(), '.env');
const NODE_URL = process.env.AZTEC_NODE_URL ?? 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSponsoredFPCInstance() {
    return getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact,
        { salt: new Fr(SPONSORED_FPC_SALT) }
    );
}

async function setupWallet(): Promise<EmbeddedWallet> {
    const node = createAztecNodeClient(NODE_URL);
    return EmbeddedWallet.create(node, { ephemeral: true });
}

function saveCredentials(secretKey: Fr, signingKey: GrumpkinScalar, salt: Fr, address: AztecAddress) {
    const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';

    // Remove any previous values for these keys
    const filtered = existing
        .split('\n')
        .filter(line => !line.startsWith('SECRET=') && !line.startsWith('SIGNING_KEY=') && !line.startsWith('SALT=') && !line.startsWith('ACCOUNT_ADDRESS='))
        .join('\n');

    const credentials = [
        `SECRET=${secretKey.toString()}`,
        `SIGNING_KEY=${signingKey.toString()}`,
        `SALT=${salt.toString()}`,
        `ACCOUNT_ADDRESS=${address.toString()}`,
    ].join('\n');

    fs.writeFileSync(ENV_FILE, filtered ? `${filtered.trimEnd()}\n${credentials}\n` : `${credentials}\n`);
    logger.info(`Credentials saved to ${ENV_FILE}`);
}

function hasCredentials(): boolean {
    dotenv.config({ path: ENV_FILE });
    return !!(process.env.SECRET && process.env.SIGNING_KEY && process.env.SALT);
}

// ---------------------------------------------------------------------------
// Create & deploy a new Schnorr account
// ---------------------------------------------------------------------------

async function createAndDeployAccount() {
    logger.info('=== Creating new Schnorr account ===');

    const wallet = await setupWallet();

    // 1. Generate keys
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    // 2. Create account manager (derives address deterministically)
    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    logger.info(`Account address: ${account.address}`);

    // 3. Setup sponsored fee payment (free on local / devnet)
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // 4. Simulate then deploy (simulate surfaces revert reasons instantly)
    const deployMethod = await account.getDeployMethod();
    await deployMethod.simulate({ from: AztecAddress.ZERO });
    const tx = await deployMethod.send({
        from: AztecAddress.ZERO,   // no sender for account deployment
        fee: { paymentMethod },
        wait: { timeout: 120000 },
    });
    logger.info(`Account deployed! tx: ${tx.txHash}`);

    // 5. Save credentials so they can be recovered later
    saveCredentials(secretKey, signingKey, salt, account.address);

    return account;
}

// ---------------------------------------------------------------------------
// Recover an existing account from saved credentials
// ---------------------------------------------------------------------------

async function recoverAccount() {
    logger.info('=== Recovering account from saved credentials ===');

    // Load .env if not already in environment
    dotenv.config({ path: ENV_FILE });

    if (!process.env.SECRET || !process.env.SIGNING_KEY || !process.env.SALT) {
        throw new Error('Missing credentials: SECRET, SIGNING_KEY, and SALT must be set in .env');
    }

    const secretKey = Fr.fromString(process.env.SECRET);
    const signingKey = GrumpkinScalar.fromString(process.env.SIGNING_KEY);
    const salt = Fr.fromString(process.env.SALT);

    const wallet = await setupWallet();

    // Passing the same keys + salt reproduces the exact same address
    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

    logger.info(`Recovered account: ${account.address}`);

    if (process.env.ACCOUNT_ADDRESS && account.address.toString() !== process.env.ACCOUNT_ADDRESS) {
        throw new Error(
            `Address mismatch!\nExpected: ${process.env.ACCOUNT_ADDRESS}\nGot: ${account.address}`
        );
    }

    // Register as sender so the wallet can build transactions from this address
    await wallet.registerSender(account.address);

    return account;
}

// ---------------------------------------------------------------------------
// Entry point — create on first run, recover on subsequent runs
// ---------------------------------------------------------------------------

async function main() {
    if (hasCredentials()) {
        const account = await recoverAccount();
        logger.info(`Ready to use recovered account at ${account.address}`);
    } else {
        const account = await createAndDeployAccount();
        logger.info(`Ready to use new account at ${account.address}`);
        logger.info('Credentials written to .env — rerun to recover this account.');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
