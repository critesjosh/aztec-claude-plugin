/**
 * Schnorr Account Management Script
 *
 * Demonstrates:
 *   1. Creating and deploying a new Schnorr account
 *   2. Saving credentials to .env
 *   3. Recovering the account from saved credentials
 *
 * Usage:
 *   npx ts-node --esm src/schnorr_account.ts
 */

import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { Fr } from '@aztec/aztec.js/fields';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createLogger } from '@aztec/foundation/log';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const logger = createLogger('aztec:schnorr-account');

// ─── Config ──────────────────────────────────────────────────────────────────

const NODE_URL = process.env.AZTEC_NODE_URL ?? 'http://localhost:8080';
const CREDENTIALS_FILE = path.resolve(process.cwd(), '.env');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createWallet(): Promise<EmbeddedWallet> {
  const node = createAztecNodeClient(NODE_URL);
  return EmbeddedWallet.create(node, { ephemeral: true });
}

async function getSponsoredFPC() {
  return getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: new Fr(SPONSORED_FPC_SALT) },
  );
}

// ─── Create & Deploy ─────────────────────────────────────────────────────────

/**
 * Creates a new Schnorr account, deploys it, and saves credentials to .env.
 */
async function createAndDeployAccount() {
  logger.info('=== Creating new Schnorr account ===');

  const wallet = await createWallet();

  // 1. Generate keys
  const secretKey = Fr.random();
  const signingKey = GrumpkinScalar.random();
  const salt = Fr.random();

  // 2. Create account manager (deterministic address derivation, no network call)
  const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
  logger.info(`Account address: ${account.address}`);

  // 3. Setup sponsored fee payment
  const sponsoredFPC = await getSponsoredFPC();
  await wallet.registerContract({ artifact: SponsoredFPCContractArtifact, instance: sponsoredFPC });
  const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  // 4. Simulate before send — surfaces revert reasons instantly
  const deployMethod = await account.getDeployMethod();
  await deployMethod.simulate({ from: AztecAddress.ZERO });

  // 5. Deploy account contract
  const tx = await deployMethod.send({
    from: AztecAddress.ZERO,   // no sender for account deployment
    fee: { paymentMethod },
    wait: { timeout: 120_000 },
  });

  logger.info(`Account deployed. Tx hash: ${tx.txHash}`);

  // 6. Save credentials so the account can be recovered later
  saveCredentials({
    secretKey: secretKey.toString(),
    signingKey: signingKey.toString(),
    salt: salt.toString(),
    address: account.address.toString(),
  });

  logger.info('Credentials saved to .env');
  return account;
}

// ─── Recover ─────────────────────────────────────────────────────────────────

/**
 * Reconstructs an AccountManager from saved .env credentials.
 *
 * The address is derived deterministically from (secretKey, salt, signingKey),
 * so no network access is needed to determine the address. The account must
 * have already been deployed before it can send transactions.
 */
async function recoverAccount() {
  logger.info('=== Recovering account from credentials ===');

  dotenv.config({ path: CREDENTIALS_FILE });

  const { SECRET, SIGNING_KEY, SALT, ADDRESS } = process.env;
  if (!SECRET || !SIGNING_KEY || !SALT) {
    throw new Error('Missing credentials. Run createAndDeployAccount() first.');
  }

  const secretKey = Fr.fromString(SECRET);
  const signingKey = GrumpkinScalar.fromString(SIGNING_KEY);
  const salt = Fr.fromString(SALT);

  const wallet = await createWallet();
  const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);

  logger.info(`Recovered address: ${account.address}`);

  // Verify the derived address matches what was saved
  if (ADDRESS && account.address.toString() !== ADDRESS) {
    throw new Error(
      `Address mismatch!\n  expected: ${ADDRESS}\n  got:      ${account.address}`,
    );
  }

  logger.info('Address verified — credentials are valid');
  return account;
}

// ─── Credential persistence ───────────────────────────────────────────────────

interface Credentials {
  secretKey: string;
  signingKey: string;
  salt: string;
  address: string;
}

function saveCredentials(creds: Credentials) {
  // Merge with any existing .env content so we don't overwrite unrelated vars
  const existing = fs.existsSync(CREDENTIALS_FILE)
    ? fs.readFileSync(CREDENTIALS_FILE, 'utf8')
    : '';

  const lines = existing.split('\n').filter(
    (l) => !l.startsWith('SECRET=') &&
            !l.startsWith('SIGNING_KEY=') &&
            !l.startsWith('SALT=') &&
            !l.startsWith('ADDRESS='),
  );

  lines.push(
    `SECRET=${creds.secretKey}`,
    `SIGNING_KEY=${creds.signingKey}`,
    `SALT=${creds.salt}`,
    `ADDRESS=${creds.address}`,
  );

  fs.writeFileSync(CREDENTIALS_FILE, lines.join('\n') + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2] ?? 'create';

  if (mode === 'create') {
    await createAndDeployAccount();
  } else if (mode === 'recover') {
    await recoverAccount();
  } else {
    console.error(`Unknown mode "${mode}". Use: create | recover`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
