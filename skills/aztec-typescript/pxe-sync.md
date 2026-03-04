# PXE Sync and Registration

## What PXE Does

The **Private Execution Environment (PXE)** runs on the user's device (browser, server, CLI). It is not a node — it talks to a node. PXE handles:

- **Key management**: Stores encryption, nullifier, and signing keys
- **Note storage**: Maintains a local database of decrypted notes the user owns
- **Proof generation**: Executes private functions and generates kernel proofs
- **Note discovery**: Scans encrypted logs from new blocks to find notes addressed to the user
- **Nullifier tracking**: Checks which notes have been spent

Think of PXE as a "private wallet runtime" — it's where all the secret stuff happens.

## What EmbeddedWallet.create() Does

`EmbeddedWallet.create(node, options)` initializes a complete PXE instance:

1. Connects to the Aztec node for block data and transaction submission
2. Generates or loads encryption keys (for decrypting notes) and nullifier keys
3. Creates the local note database (in-memory if `ephemeral: true`, or on disk with `dataDirectory`)
4. Starts the sync loop that watches for new blocks

With `ephemeral: true`, all state is lost when the process exits — good for tests and scripts. With a `dataDirectory`, notes and keys persist across restarts so the PXE doesn't need to rescan the entire chain.

For PXE wallet internals, see [Wallet Setup](./wallet-setup.md).

## What registerContract Does

`wallet.registerContract(instance, artifact)` tells the PXE: "This contract exists at this address with this ABI."

Without registration, PXE **silently ignores** notes from that contract. Registration enables PXE to:

1. **Decode encrypted note logs** — the artifact defines note types and their encryption scheme
2. **Compute nullifiers** — the artifact defines how nullifiers are derived for each note type
3. **Generate proofs** — calling contract methods requires the artifact's circuit bytecode
4. **Identify storage slots** — maps note types to storage slot computations

```typescript
// Register so PXE can discover notes from this contract
await wallet.registerContract(tokenInstance, TokenContract.artifact);
```

**Critical timing:** You must register a contract *before* any transaction that creates notes you want to discover. If you deploy a contract and then interact with it in the same script, registration typically happens automatically via the deployment flow. But if you're connecting to an already-deployed contract, you must register it manually.

## What registerSender Does

`wallet.registerSender(address)` tells PXE to watch for notes tagged by a specific sender.

Aztec uses **tag-based note discovery**: when a note is created, the sender and recipient collaborate on a shared tagging secret. PXE uses this secret to efficiently identify which encrypted logs are meant for it, without trying to decrypt every log on chain.

```typescript
// Register another account so PXE can find notes they send us
await wallet.registerSender(otherAccount.address);
```

In Noir, the corresponding operation is `set_sender_for_tags()` — the SchnorrAccount constructor sets this to `self.address` so users don't need to register the account deployer.

**When it's needed:** Multi-account setups where Account A sends notes to Account B. Account B's PXE needs `registerSender(A.address)` to compute the shared tagging secret and discover those notes.

## PXE Sync Cycle

On each new block, PXE runs the following cycle:

```
New block detected
     │
     ├─ 1. Fetch encrypted note logs from the block
     │
     ├─ 2. For each registered contract:
     │      ├─ Check tagged logs using shared secrets with registered senders
     │      ├─ Attempt decryption with user's encryption key
     │      └─ Successfully decrypted → add note to local database
     │
     ├─ 3. Check nullifier tree for spent notes
     │      └─ If a local note's nullifier is in the tree → mark as spent/remove
     │
     └─ 4. Update sync position to this block number
```

**Implication:** After sending a transaction, notes created by that transaction are not available in the local database until:
1. The transaction is included in a block
2. PXE syncs to that block
3. PXE successfully decrypts the note logs

This is why transactions use `wait: { timeout }` — they wait for block inclusion and PXE sync.

## Setup Ordering and Why It Matters

The initialization sequence has strict dependencies. Here's the correct order with rationale:

```typescript
// 1. Connect to node — everything else needs network access
const node = createAztecNodeClient(nodeUrl);

// 2. Create EmbeddedWallet — this creates the PXE instance
const wallet = await EmbeddedWallet.create(node, { ephemeral: true });

// 3. Register FPC contract — PXE needs this before ANY fee-paying transaction
//    Without it, PXE can't construct fee payment proofs
const sponsoredFPC = await getSponsoredFPCInstance();
await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

// 4. Create account — derives address deterministically, no network call needed
const secretKey = Fr.random();
const account = await AccountManager.create(wallet, secretKey);

// 5. Deploy account contract — first real transaction
//    Uses AztecAddress.ZERO as sender (no account exists yet to send from)
//    Needs FPC registered (step 3) to pay fees
const deployMethod = await account.getDeployMethod();
await deployMethod.simulate({ from: AztecAddress.ZERO });
await deployMethod.send({
    from: AztecAddress.ZERO,
    fee: { paymentMethod },
    wait: { timeout: 600 }
});

// 6. Deploy app contract — needs deployed account as sender
const deployRequest = MyContract.deploy(wallet, account.address);
await deployRequest.simulate({ from: account.address });
const contract = await deployRequest.send({
    from: account.address,
    fee: { paymentMethod },
    wait: { timeout: 600, returnReceipt: true }
});

// 7. Register app contract on other wallets — if other PXEs need to discover notes
//    The deploying wallet auto-registers, but other wallets do not
await otherWallet.registerContract(contract, MyContract.artifact);
```

### Why This Order?

| Step | Depends On | Reason |
|------|-----------|--------|
| Create wallet | Node connection | PXE syncs from the node |
| Register FPC | Wallet exists | Registration is a PXE operation |
| Create account | Wallet exists | Needs PXE for key derivation |
| Deploy account | FPC registered | Deployment needs fee payment |
| Deploy app contract | Account deployed | Needs a real sender address |
| Register on other wallets | Contract deployed | Need the address and artifact |

## Common Pitfalls

### "Notes not appearing"
**Cause:** Forgot `registerContract`. PXE silently ignores notes from unregistered contracts.
**Fix:** `await wallet.registerContract(instance, artifact)` before the transaction that creates notes.

### "Transaction hangs for 600 seconds"
**Cause:** Forgot `.simulate()` before `.send()`. The transaction reverts on the sequencer but you only find out at timeout.
**Fix:** Always call `.simulate()` first — it surfaces revert reasons instantly.

### "Cannot find notes from another account"
**Cause:** Forgot `registerSender`. PXE can't compute the shared tagging secret.
**Fix:** `await wallet.registerSender(senderAddress)` on the recipient's wallet.

### "Account deployment fails"
**Cause:** Using account address as sender before account is deployed.
**Fix:** Use `AztecAddress.ZERO` as the `from` address for account deployment.

### "FPC-related errors on first transaction"
**Cause:** FPC contract not registered before sending a fee-paying transaction.
**Fix:** Register FPC immediately after creating the wallet, before any other transactions.

## Reference
`EmbeddedWallet` — wallet creation and PXE initialization
`wallet-setup.md` — detailed wallet configuration patterns
`schnorr_account_contract` — `set_sender_for_tags` usage in constructor
