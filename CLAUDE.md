# Aztec Development Guidelines

This project uses the Aztec Network for privacy-preserving smart contract development.

## Technology Stack

- **Noir**: Domain-specific language for writing Aztec smart contracts
- **Aztec.nr**: Noir framework for Aztec contract development
- **PXE (Private Execution Environment)**: Client-side execution for private functions

## Code Philosophy

You are writing application code, not library code. Application code should fail fast and loud. Do not add resilience patterns (retries, fallbacks, default values) unless explicitly requested. The developer's debugging experience is more important than the app "not crashing" — a crash with a clear error message is always better than silent misbehavior.

## ⚠️ Critical: Aztec ≠ Solidity

### Private State = Notes

In Solidity, you read/write storage slots. In Aztec, private state uses **notes**:

- Notes are encrypted, off-chain data that only the owner can decrypt
- To "update" private state, you consume (nullify) the old note and create a new one
- You cannot iterate over notes or query them like a database

### Nullifiers Prevent Double-Spend

- When you spend a note, its nullifier is published on-chain
- The protocol rejects any transaction that reuses a nullifier

### Account Contracts Handle Auth

- Users deploy their own **account contract** that defines their auth rules
- App contracts call `self.msg_sender()` — returns `AztecAddress` (panics if None)
- Use `self.context.maybe_msg_sender()` → `Option<AztecAddress>` in entrypoints or incognito-callable functions
- msg_sender is **None** at tx entrypoints (account contracts) and in incognito enqueued public calls
- msg_sender in enqueued public calls is **visible on-chain** — use `self.enqueue_incognito()` to hide it

### Private-to-Private Calls Compose in One Proof

- Private function calling another private function happens in the same client-side transaction
- The PXE composes all private calls into one proof before submission

## Quick Reference

### Basic Contract Template

```rust
use aztec::macros::aztec;

#[aztec]
pub contract MyContract {
    use aztec::macros::{functions::{external, initializer, view}, storage::storage};
    use aztec::protocol::address::AztecAddress;
    use aztec::state_vars::{Map, PublicMutable, Owned};
    use balance_set::BalanceSet;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        balances: Owned<BalanceSet<Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }

    #[external("public")]
    #[view]
    fn balance_of_public(owner: AztecAddress) -> u128 {
        self.storage.public_balances.at(owner).read()
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }
}
```

### Function Attributes

| Attribute | Purpose |
|-----------|---------|
| `#[external("private")]` | Executes in PXE, can read/write private state |
| `#[external("public")]` | Executes on sequencer, visible to everyone |
| `#[external("utility")]` + `unconstrained` | Off-chain reads without proofs |
| `#[view]` | Read-only, doesn't modify state |
| `#[internal("private")]` | Only callable by the contract itself (private context) |
| `#[internal("public")]` | Only callable by the contract itself (public context) |
| `#[initializer]` | Constructor function |
| `#[only_self]` | Restricts function to self-calls only (asserts msg_sender == self.address) |
| `#[authorize_once("from", "nonce")]` | Requires authwit authorization, consumed after one use |
| `#[allow_phase_change]` | Allows private-to-public phase transition (used in FPC) |
| `#[contract_library_method]` | Helper function, no ABI entry generated |

### Detailed Documentation

For comprehensive patterns, see the skills:

- **[Contract Development](./skills/aztec-developer/contract-dev/index.md)** - Storage, notes, cross-contract calls
- **[Unit Testing](./skills/aztec-developer/txe/index.md)** - TXE test environment
- **[Contract Review](./skills/review-contract/SKILL.md)** - Security review checklist

## ⚠️ Critical: Note Ownership

**Only the owner of a note can nullify (spend/replace/delete) it.**

- Fields on notes are just data, not permissions
- Storing a `sender` address does NOT allow the sender to modify that note
- If you need multi-party access, use public storage instead

See [Notes Pattern](./skills/aztec-developer/contract-dev/notes.md) for detailed guidance.

## Project Structure

```
project/
├── contracts/
│   └── my_contract/
│       ├── Nargo.toml
│       └── src/main.nr
├── src/index.ts
└── package.json
```

## Dependencies in Nargo.toml

```toml
[package]
name = "my_contract"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v4.1.0-rc.2", directory = "aztec" }
```

## Version Detection

**IMPORTANT: Detect the user's Aztec version before writing code.**

Extract the version from `Nargo.toml`:

```toml
aztec = { git = "...", tag = "v4.1.0-rc.2", ... }
```

If version differs from `v4.1.0-rc.2`:
- Warn the user that patterns may not match their version
- Prioritize Aztec MCP server over examples in this file

## ⚠️ MANDATORY: Always Use Aztec MCP Server First

**The Aztec API changes frequently. Query the @aztec/mcp-server BEFORE writing any Aztec code.**

### Workflow

```
User asks Aztec question
         ↓
   aztec_sync_repos() (if not done)
         ↓
   aztec_search_code() or aztec_search_docs()
         ↓
   aztec_read_example() if needed
         ↓
   Respond with VERIFIED current syntax
```

### When to Use

- Library/API documentation
- Code generation
- Setup or configuration
- Syntax or patterns
- Error troubleshooting

### Switching Versions

```bash
/aztec-version                    # Autodetect from Nargo.toml
/aztec-version v4.1.0-rc.2    # Use specific version
```

Or pass version to sync:
```
aztec_sync_repos({ version: "v4.1.0-rc.2", force: true })
```

## ⚠️ Critical: Simulate Before Send

**Always call `.simulate()` before `.send()` for every state-changing transaction.**

Without simulation, failing transactions hang for up to 600 seconds with opaque errors. `.simulate()` surfaces revert reasons instantly.

```typescript
// Standard method call
await contract.methods.myMethod(args).simulate({ from: account.address });
const tx = await contract.methods.myMethod(args).send({
    from: account.address,
    fee: { paymentMethod },
    wait: { timeout: 600 }
});

// Contract deployment (break the chain)
const deployRequest = MyContract.deploy(wallet, admin);
await deployRequest.simulate({ from: admin });
const contract = await deployRequest.send({
    from: admin, fee: { paymentMethod }, wait: { timeout, returnReceipt: true }
});

// Account deployment (break the chain)
const deployMethod = await account.getDeployMethod();
await deployMethod.simulate({ from: AztecAddress.ZERO });
await deployMethod.send({
    from: AztecAddress.ZERO, fee: { paymentMethod }, wait: { timeout }
});
```

**Key rules:**
- `.simulate()` only needs `from` — no `fee`, `wait`, or `authWitnesses`
- For deploy chains, break into a variable first, then simulate, then send
- For error tests, use `.simulate()` instead of `.send()` to catch reverts
- View/read-only calls already use `.simulate()` — skip those

## Useful Resources

- Aztec Documentation: https://docs.aztec.network
- Noir Language: https://noir-lang.org
- Aztec GitHub: https://github.com/AztecProtocol/aztec-packages
