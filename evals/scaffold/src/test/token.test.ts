import { TokenContract } from '../artifacts/Token.js';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { TxStatus } from '@aztec/stdlib/tx';
import { createLogger } from '@aztec/aztec.js/log';
import type { AccountManager } from '@aztec/aztec.js/wallet';

const NODE_URL = process.env.AZTEC_NODE_URL ?? 'http://localhost:8080';
const DEPLOY_TIMEOUT = 120_000; // 2 min — account/contract deployment
const TX_TIMEOUT = 60_000;     // 1 min — regular state-changing call

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createWallet(): Promise<EmbeddedWallet> {
    const node = createAztecNodeClient(NODE_URL);
    return EmbeddedWallet.create(node, { ephemeral: true });
}

async function getSponsoredFPCInstance() {
    return getContractInstanceFromInstantiationParams(
        SponsoredFPCContractArtifact,
        { salt: new Fr(SPONSORED_FPC_SALT) },
    );
}

// Deploy a fresh Schnorr account using sponsored fees.
// Account contracts must be sent from AztecAddress.ZERO — no account
// exists yet to pay from.
async function deployAccount(
    wallet: EmbeddedWallet,
    paymentMethod: SponsoredFeePaymentMethod,
): Promise<AccountManager> {
    const account = await wallet.createSchnorrAccount(
        Fr.random(),
        Fr.random(),              // salt
        GrumpkinScalar.random(),  // signing key
    );
    const deployMethod = await account.getDeployMethod();
    await deployMethod.simulate({ from: AztecAddress.ZERO });
    await deployMethod.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: DEPLOY_TIMEOUT },
    });
    return account;
}

// Accepted terminal states for a successfully landed transaction.
const SUCCESS_STATUSES = [
    TxStatus.PROPOSED,
    TxStatus.CHECKPOINTED,
    TxStatus.PROVEN,
    TxStatus.FINALIZED,
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Token Contract E2E', () => {
    const logger = createLogger('aztec:test:token');

    let wallet: EmbeddedWallet;
    let paymentMethod: SponsoredFeePaymentMethod;
    let alice: AccountManager;   // admin — mints and transfers
    let bob: AccountManager;     // recipient
    let token: TokenContract;

    const INITIAL_SUPPLY = 1_000n;  // minted to alice at deploy time
    const MINT_AMOUNT = 500n;       // additional mint to bob
    const TRANSFER_AMOUNT = 200n;   // alice → bob public transfer
    const SHIELD_AMOUNT = 100n;     // alice public → private

    // =======================================================================
    // Setup — wallet, FPC, two accounts, contract
    // =======================================================================
    // Order matters:
    //   1. Wallet  (creates PXE)
    //   2. FPC     (must be registered before any fee-paying tx)
    //   3. Accounts (deploy from AztecAddress.ZERO)
    //   4. registerSender (enables tag-based note discovery)
    //   5. Token contract (needs a real sender address)

    beforeAll(async () => {
        logger.info('Setting up test environment...');

        // 1. Wallet
        wallet = await createWallet();

        // 2. Sponsored FPC — free on local / devnet; eliminates token management
        const sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // 3. Deploy alice and bob in parallel
        [alice, bob] = await Promise.all([
            deployAccount(wallet, paymentMethod),
            deployAccount(wallet, paymentMethod),
        ]);

        // 4. Register senders so PXE can compute the shared tagging secret
        //    and discover private notes addressed to these accounts.
        await wallet.registerSender(alice.address, 'alice');
        await wallet.registerSender(bob.address, 'bob');

        // 5. Deploy Token contract — alice is admin and receives INITIAL_SUPPLY
        const deployReq = TokenContract.deploy(wallet, alice.address, INITIAL_SUPPLY);
        await deployReq.simulate({ from: alice.address });
        token = await deployReq
            .send({
                from: alice.address,
                fee: { paymentMethod },
                wait: { timeout: DEPLOY_TIMEOUT },
            })
            .deployed();

        logger.info(`Token deployed at ${token.address}`);
    }, 600_000); // 10-minute cap for the entire setup block

    // =======================================================================
    // 1. Deployment verification
    // =======================================================================

    it('should deploy the Token contract at a non-zero address', () => {
        expect(token.address.toString()).not.toBe(AztecAddress.ZERO.toString());
    });

    it('should initialise alice\'s public balance to INITIAL_SUPPLY', async () => {
        const balance = await token.methods
            .balance_of_public(alice.address)
            .simulate({ from: alice.address });
        expect(balance).toBe(INITIAL_SUPPLY);
    });

    it('should initialise total_supply to INITIAL_SUPPLY', async () => {
        const supply = await token.methods
            .total_supply()
            .simulate({ from: alice.address });
        expect(supply).toBe(INITIAL_SUPPLY);
    });

    // =======================================================================
    // 2. Minting
    // =======================================================================

    it('should allow admin to mint public tokens to bob', async () => {
        // Always simulate first — surfaces revert reasons instantly instead of
        // hanging for up to 600 s on a failed send().
        await token.methods
            .mint_public(bob.address, MINT_AMOUNT)
            .simulate({ from: alice.address });

        const tx = await token.methods
            .mint_public(bob.address, MINT_AMOUNT)
            .send({
                from: alice.address,
                fee: { paymentMethod },
                wait: { timeout: TX_TIMEOUT },
            });

        expect(SUCCESS_STATUSES).toContain(tx.status);

        const bobBalance = await token.methods
            .balance_of_public(bob.address)
            .simulate({ from: alice.address });
        expect(bobBalance).toBe(MINT_AMOUNT);
    }, TX_TIMEOUT * 3);

    it('should increase total_supply after minting', async () => {
        const supply = await token.methods
            .total_supply()
            .simulate({ from: alice.address });
        expect(supply).toBe(INITIAL_SUPPLY + MINT_AMOUNT);
    });

    it('should reject mint from a non-admin account', async () => {
        // Use .simulate() for error tests — never .send() — to get the revert
        // reason immediately rather than timing out after 600 s.
        await expect(
            token.methods
                .mint_public(bob.address, 1n)
                .simulate({ from: bob.address }),
        ).rejects.toThrow();
    }, 30_000);

    // =======================================================================
    // 3. Public transfer
    // =======================================================================

    it('should transfer public tokens from alice to bob', async () => {
        const aliceBefore = await token.methods
            .balance_of_public(alice.address)
            .simulate({ from: alice.address });
        const bobBefore = await token.methods
            .balance_of_public(bob.address)
            .simulate({ from: alice.address });

        await token.methods
            .transfer_public(alice.address, bob.address, TRANSFER_AMOUNT)
            .simulate({ from: alice.address });

        const tx = await token.methods
            .transfer_public(alice.address, bob.address, TRANSFER_AMOUNT)
            .send({
                from: alice.address,
                fee: { paymentMethod },
                wait: { timeout: TX_TIMEOUT },
            });

        expect(SUCCESS_STATUSES).toContain(tx.status);

        const aliceAfter = await token.methods
            .balance_of_public(alice.address)
            .simulate({ from: alice.address });
        const bobAfter = await token.methods
            .balance_of_public(bob.address)
            .simulate({ from: alice.address });

        expect(aliceAfter).toBe(aliceBefore - TRANSFER_AMOUNT);
        expect(bobAfter).toBe(bobBefore + TRANSFER_AMOUNT);
    }, TX_TIMEOUT * 3);

    it('should reject transfer when caller is not the from address', async () => {
        // transfer_public asserts caller == from; bob cannot move alice's tokens.
        await expect(
            token.methods
                .transfer_public(alice.address, bob.address, 1n)
                .simulate({ from: bob.address }),
        ).rejects.toThrow();
    }, 30_000);

    it('should reject transfer when balance is insufficient', async () => {
        await expect(
            token.methods
                .transfer_public(alice.address, bob.address, 999_999_999n)
                .simulate({ from: alice.address }),
        ).rejects.toThrow();
    }, 30_000);

    // =======================================================================
    // 4. Shield — public → private
    // =======================================================================
    // shield() is a private function that:
    //   a) inserts a private note (adds SHIELD_AMOUNT to alice's private balance)
    //   b) enqueues a public call to subtract SHIELD_AMOUNT from alice's public balance
    //
    // We can only directly observe (b) — the public balance decrease — because
    // this contract does not expose a balance_of_private utility function.

    it('should shield tokens, reducing alice\'s public balance by SHIELD_AMOUNT', async () => {
        const publicBefore = await token.methods
            .balance_of_public(alice.address)
            .simulate({ from: alice.address });

        await token.methods
            .shield(SHIELD_AMOUNT)
            .simulate({ from: alice.address });

        const tx = await token.methods
            .shield(SHIELD_AMOUNT)
            .send({
                from: alice.address,
                fee: { paymentMethod },
                wait: { timeout: TX_TIMEOUT },
            });

        expect(SUCCESS_STATUSES).toContain(tx.status);

        const publicAfter = await token.methods
            .balance_of_public(alice.address)
            .simulate({ from: alice.address });

        expect(publicAfter).toBe(publicBefore - SHIELD_AMOUNT);
    }, TX_TIMEOUT * 3);

    it('should reject shielding more than alice\'s public balance', async () => {
        await expect(
            token.methods
                .shield(999_999_999n)
                .simulate({ from: alice.address }),
        ).rejects.toThrow();
    }, 30_000);
});
