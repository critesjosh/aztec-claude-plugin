# Integration Test Recipe

A complete, copy-paste-ready E2E test template covering multi-account setup, authwit, cross-contract calls, private balance verification, and error testing. Adapt this to your contract.

## Complete Test Template

```typescript
// ============================================================================
// Integration Test Recipe — Aztec E2E
// Copy this file, replace MyContract/TokenContract with your contracts.
// ============================================================================

import { MyContract } from "../../artifacts/MyContract.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { type ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { TxStatus } from "@aztec/stdlib/tx";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

// ---------------------------------------------------------------------------
// Helpers — extracted so tests stay readable
// ---------------------------------------------------------------------------

/** Deploy a Schnorr account with simulate-before-send. */
async function deployAccount(
  wallet: EmbeddedWallet,
  paymentMethod: SponsoredFeePaymentMethod,
  timeout: number,
): Promise<AccountManager> {
  const account = await wallet.createSchnorrAccount(
    Fr.random(),
    Fr.random(),          // salt
    GrumpkinScalar.random(), // signing key
  );
  const deployMethod = await account.getDeployMethod();
  // Account contracts deploy from ZERO — no account exists yet to pay.
  await deployMethod.simulate({ from: AztecAddress.ZERO });
  await deployMethod.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod },
    wait: { timeout },
  });
  return account;
}

/** Send a transaction with simulate-before-send and TxStatus assertion. */
async function sendTx(
  call: { simulate: (opts: any) => Promise<any>; send: (opts: any) => Promise<any> },
  from: AztecAddress,
  paymentMethod: SponsoredFeePaymentMethod,
  timeout: number,
  authWitnesses?: any[],
) {
  // .simulate() only needs `from` — surfaces revert reasons instantly.
  await call.simulate({ from });
  const receipt = await call.send({
    from,
    fee: { paymentMethod },
    ...(authWitnesses ? { authWitnesses } : {}),
    wait: { timeout },
  });
  // A successful tx lands in one of these states depending on how far the
  // network has progressed. All indicate success.
  expect(
    [TxStatus.PROPOSED, TxStatus.CHECKPOINTED, TxStatus.PROVEN, TxStatus.FINALIZED],
  ).toContain(receipt.status);
  return receipt;
}

/** Read a private balance — must simulate as the note owner. */
async function getPrivateBalance(
  token: any,
  owner: AztecAddress,
): Promise<bigint> {
  return token.methods.balance_of_private(owner).simulate({ from: owner });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Integration Test Recipe", () => {
  let logger: Logger;
  let wallet: EmbeddedWallet;
  let paymentMethod: SponsoredFeePaymentMethod;
  let alice: AccountManager;   // Account 1
  let bob: AccountManager;     // Account 2
  let appContract: MyContract;
  let tokenContract: any;      // Replace `any` with your token type

  // =========================================================================
  // Setup: 2 accounts + FPC + contracts
  // =========================================================================
  // The ordering here is critical. See pxe-sync.md for the full rationale.
  //   1. Wallet  (creates PXE)
  //   2. FPC     (needed before ANY fee-paying tx)
  //   3. Accounts (deploy from AztecAddress.ZERO)
  //   4. Register senders (so PXE discovers notes via tag-based lookup)
  //   5. App contracts (need a real sender address)

  beforeAll(async () => {
    logger = createLogger("aztec:test:integration-recipe");
    const timeouts = getTimeouts();

    // --- 1. Wallet ---
    wallet = await setupWallet();

    // --- 2. Sponsored FPC ---
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // --- 3. Deploy two accounts in parallel ---
    // Both deploy from AztecAddress.ZERO (no existing account to pay from).
    [alice, bob] = await Promise.all([
      deployAccount(wallet, paymentMethod, timeouts.deployTimeout),
      deployAccount(wallet, paymentMethod, timeouts.deployTimeout),
    ]);

    // --- 4. Register senders ---
    // PXE uses tag-based note discovery. Without registerSender, this PXE
    // can't compute the shared tagging secret for notes sent by these accounts.
    // The second argument is an optional human-readable label for debugging.
    await wallet.registerSender(alice.address, "alice");
    await wallet.registerSender(bob.address, "bob");

    // --- 5. Deploy app contract ---
    const appDeploy = MyContract.deploy(wallet, alice.address);
    await appDeploy.simulate({ from: alice.address });
    appContract = await appDeploy
      .send({
        from: alice.address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
      })
      .deployed();

    // --- 6. (Optional) Deploy a token contract for transfer tests ---
    const tokenDeploy = TokenContract.deploy(
      wallet,
      alice.address, // owner / admin
      "Test Token",
      "TST",
      18,
    );
    await tokenDeploy.simulate({ from: alice.address });
    tokenContract = await tokenDeploy
      .send({
        from: alice.address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
      })
      .deployed();

    logger.info(
      `Setup complete — app: ${appContract.address}, token: ${tokenContract.address}`,
    );
  }, 600_000); // 10 minutes for full setup

  // =========================================================================
  // 1. Deployment verification
  // =========================================================================

  it("should deploy and verify contracts", () => {
    expect(appContract.address.toString()).not.toBe(
      AztecAddress.ZERO.toString(),
    );
    expect(tokenContract.address.toString()).not.toBe(
      AztecAddress.ZERO.toString(),
    );
  });

  // =========================================================================
  // 2. Public function + state verification
  // =========================================================================

  it("should execute public function and verify state", async () => {
    const timeouts = getTimeouts();

    // Mint tokens publicly to Bob
    await sendTx(
      tokenContract.methods.mint_to_public(bob.address, 1000n),
      alice.address, // admin/owner calls mint
      paymentMethod,
      timeouts.txTimeout,
    );

    // Read public balance — anyone can read public state
    const balance = await tokenContract.methods
      .balance_of_public(bob.address)
      .simulate({ from: alice.address });
    expect(balance).toBe(1000n);
  }, 120_000);

  // =========================================================================
  // 3. Private function + balance verification
  // =========================================================================

  it("should execute private function and verify balance", async () => {
    const timeouts = getTimeouts();

    // Mint tokens privately to Alice
    await sendTx(
      tokenContract.methods.mint_to_private(alice.address, 500n),
      alice.address,
      paymentMethod,
      timeouts.txTimeout,
    );

    // Private balance MUST be read by the note owner — only their PXE
    // has the decryption keys for those notes.
    const balance = await getPrivateBalance(tokenContract, alice.address);
    expect(balance).toBe(500n);
  }, 120_000);

  // =========================================================================
  // 4. AuthWit: authorized transfer between accounts
  // =========================================================================
  // AuthWit is Aztec's equivalent of ERC-20 approve — it authorizes a
  // specific action (not just an amount) with a single-use nonce.
  // See authwit-frontend.md for the full pattern.

  it("should transfer between accounts with authwit", async () => {
    const timeouts = getTimeouts();

    // Ensure Alice has private tokens to transfer
    await sendTx(
      tokenContract.methods.mint_to_private(alice.address, 200n),
      alice.address,
      paymentMethod,
      timeouts.txTimeout,
    );

    // 1. Generate a fresh nonce (prevents replay attacks)
    const nonce = Fr.random();

    // 2. Build the exact action to authorize
    const transferAction = tokenContract.methods.transfer_in_private(
      alice.address, // from (token owner)
      bob.address,   // to
      100n,          // amount
      nonce,
    );

    // 3. Create the authorization witness
    //    - First arg: address whose tokens are being spent
    //    - Second arg: { caller, action } — caller is the contract executing
    const witness = await wallet.createAuthWit(alice.address, {
      caller: appContract.address,
      action: transferAction,
    });

    // 4. Execute with the witness attached
    //    The app contract internally calls token.transfer_in_private(...)
    //    which checks the authwit.
    await sendTx(
      appContract.methods.transfer_tokens(
        tokenContract.address,
        alice.address,
        bob.address,
        100n,
        nonce,
      ),
      alice.address,
      paymentMethod,
      timeouts.txTimeout,
      [witness],
    );

    // 5. Verify balances updated on both sides
    const aliceBalance = await getPrivateBalance(tokenContract, alice.address);
    const bobBalance = await getPrivateBalance(tokenContract, bob.address);
    // Alice started with 200 + 500 from previous test, spent 100
    expect(aliceBalance).toBeGreaterThanOrEqual(100n);
    expect(bobBalance).toBeGreaterThan(0n);
  }, 180_000);

  // =========================================================================
  // 5. Cross-contract interaction
  // =========================================================================
  // When contract A calls contract B, private-to-private calls compose in
  // the same client-side proof. Public calls are enqueued and execute on
  // the sequencer.

  it("should handle cross-contract calls", async () => {
    const timeouts = getTimeouts();

    // App contract calls token contract's public mint internally.
    // The key insight: private→public calls are "enqueued" — they execute
    // later on the sequencer, not in the same private proof.
    await sendTx(
      appContract.methods.do_something_with_token(
        tokenContract.address,
        alice.address,
        50n,
      ),
      alice.address,
      paymentMethod,
      timeouts.txTimeout,
    );
  }, 120_000);

  // =========================================================================
  // 6. Error testing — use .simulate() to catch reverts
  // =========================================================================
  // CRITICAL: Use .simulate() for error tests, NOT .send().
  // .send() would wait up to 600s before timing out with an opaque error.
  // .simulate() surfaces the revert reason instantly.

  it("should reject unauthorized actions", async () => {
    await expect(
      // Bob is not the admin, so this should revert
      appContract.methods
        .admin_only_function()
        .simulate({ from: bob.address }),
    ).rejects.toThrow();
  }, 60_000);

  // =========================================================================
  // 7. AuthWit replay protection
  // =========================================================================
  // Each authwit nonce can only be used once. Reusing it must fail.

  it("should reject replayed authwit", async () => {
    const timeouts = getTimeouts();
    const nonce = Fr.random();

    const action = tokenContract.methods.transfer_in_private(
      alice.address,
      bob.address,
      10n,
      nonce,
    );

    const witness = await wallet.createAuthWit(alice.address, {
      caller: appContract.address,
      action,
    });

    // First use — should succeed
    await sendTx(
      appContract.methods.transfer_tokens(
        tokenContract.address,
        alice.address,
        bob.address,
        10n,
        nonce,
      ),
      alice.address,
      paymentMethod,
      timeouts.txTimeout,
      [witness],
    );

    // Second use with SAME nonce — must fail (nullifier already exists)
    await expect(
      appContract.methods
        .transfer_tokens(
          tokenContract.address,
          alice.address,
          bob.address,
          10n,
          nonce,
        )
        .simulate({ from: alice.address }),
    ).rejects.toThrow();
  }, 240_000);
});
```

## Cross-Wallet Testing (Two Separate PXEs)

When testing scenarios where two users have separate PXE instances (e.g., separate browsers), you need two wallets and explicit contract registration.

```typescript
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { TokenContract } from "@aztec/noir-contracts.js/Token";

// Two separate PXEs — simulates two different users' devices
const node = createAztecNodeClient(nodeUrl);
const wallet1 = await EmbeddedWallet.create(node, { ephemeral: true });
const wallet2 = await EmbeddedWallet.create(node, { ephemeral: true });

// Both wallets need FPC registered before any transaction
await wallet1.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
await wallet2.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);

// Deploy account on wallet1, register sender on wallet2
const alice = await deployAccount(wallet1, paymentMethod, timeout);
await wallet2.registerSender(alice.address, "alice");

// Deploy account on wallet2, register sender on wallet1
const bob = await deployAccount(wallet2, paymentMethod, timeout);
await wallet1.registerSender(bob.address, "bob");

// Deploy token from wallet1 (alice is admin)
const token = await TokenContract.deploy(wallet1, alice.address, "Token", "TKN", 18)
  .send({ from: alice.address, fee: { paymentMethod }, wait: { timeout } })
  .deployed();

// Register the deployed token contract on wallet2
// Fetch the instance from the node — the deploying wallet auto-registers,
// but other wallets need explicit registration to discover notes.
const tokenInstance = await node.getContract(token.address);
if (!tokenInstance) throw new Error("Contract not found on node");
await wallet2.registerContract(tokenInstance, TokenContract.artifact);

// Now wallet2 can interact with the token via its own PXE
const tokenOnWallet2 = await TokenContract.at(token.address, wallet2);

// Mint to Bob (via wallet1, since alice is admin)
await token.methods.mint_to_private(bob.address, 100n).simulate({ from: alice.address });
await token.methods.mint_to_private(bob.address, 100n).send({
  from: alice.address,
  fee: { paymentMethod },
  wait: { timeout },
});

// Bob reads his balance from wallet2's PXE
const balance = await tokenOnWallet2.methods
  .balance_of_private(bob.address)
  .simulate({ from: bob.address });
// balance === 100n
```

### Why This Pattern Matters

| Step | Why |
|------|-----|
| Two `EmbeddedWallet` instances | Each has its own PXE with separate note database and keys |
| `registerContract` on wallet2 | Without it, wallet2's PXE silently ignores notes from that contract |
| `registerSender` on both | Tag-based discovery needs the shared secret from both directions |
| `node.getContract()` | Gets the deployed instance from the node (avoids reconstructing locally) |
| `TokenContract.at(addr, wallet2)` | Creates a contract handle bound to wallet2's PXE for sending/simulating |

## Checklist Before Running

- [ ] Replace `MyContract` with your actual contract import
- [ ] Replace `admin_only_function`, `do_something_with_token`, `transfer_tokens` with your contract's actual methods
- [ ] Verify import paths match your project structure (`../../artifacts/`, `../../utils/`)
- [ ] Ensure `config.js` provides `getTimeouts()` with `deployTimeout` and `txTimeout`
- [ ] Run `yarn test:js` (Vitest) or `yarn test:js -- --testPathPattern="integration"` to run just this file

## Related Skills

- [PXE Sync and Registration](../aztec-typescript/pxe-sync.md) — Why setup ordering matters, registerSender/registerContract explained
- [AuthWit Frontend](../aztec-typescript/authwit-frontend.md) — Full authwit patterns including public authwit and nonce management
- [Test Runner Setup](./jest-setup.md) — Vitest/Jest configuration
- [Sponsored Testing](./sponsored-testing.md) — Fee payment in tests
