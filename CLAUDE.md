# Aztec Development Guidelines

This project uses the Aztec Network for privacy-preserving smart contract development.

## Technology Stack

- **Noir**: Domain-specific language for writing Aztec smart contracts
- **Aztec.nr**: Noir framework for Aztec contract development
- **PXE (Private Execution Environment)**: Client-side execution for private functions

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
- App contracts call `context.msg_sender()` but auth happens in the account contract

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
    use aztec::protocol_types::address::AztecAddress;
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
| `#[only_self]` | Only callable by the contract itself |
| `#[initializer]` | Constructor function |

### Detailed Documentation

For comprehensive patterns, see the skills:

- **[Contract Development](./skills/aztec-developer/contract-dev/index.md)** - Storage, notes, cross-contract calls
- **[Unit Testing](./skills/aztec-developer/txe/index.md)** - TXE test environment
- **[TypeScript Integration](./skills/aztec-typescript/SKILL.md)** - Frontend patterns
- **[Deployment](./skills/aztec-deploy/SKILL.md)** - Deploy scripts and fee payment

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
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
```

## Version Detection

**IMPORTANT: Detect the user's Aztec version before writing code.**

Extract the version from `Nargo.toml`:

```toml
aztec = { git = "...", tag = "v3.0.0-devnet.6-patch.1", ... }
```

If version differs from `v3.0.0-devnet.6-patch.1`:
- Warn the user that patterns may not match their version
- Prioritize Aztec MCP server over examples in this file

## ⚠️ MANDATORY: Always Use Aztec MCP Server First

**The Aztec API changes frequently. Query the aztec-mcp-server BEFORE writing any Aztec code.**

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
/aztec-version v3.0.0-devnet.7    # Use specific version
```

Or pass version to sync:
```
aztec_sync_repos({ version: "v3.0.0-devnet.7", force: true })
```

## Useful Resources

- Aztec Documentation: https://docs.aztec.network
- Noir Language: https://noir-lang.org
- Aztec GitHub: https://github.com/AztecProtocol/aztec-packages
