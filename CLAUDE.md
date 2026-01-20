# Aztec Development Guidelines

This project uses the Aztec Network for privacy-preserving smart contract development. Follow these guidelines when working with Aztec contracts and applications.

## Technology Stack

- **Noir**: Domain-specific language for writing Aztec smart contracts
- **Aztec.nr**: Noir framework for Aztec contract development
- **aztec-cli**: Command-line tool for deployment and interaction
- **PXE (Private Execution Environment)**: Client-side execution for private functions

## ⚠️ Critical: Aztec ≠ Solidity

### Private State = Notes

In Solidity, you read/write storage slots. In Aztec, private state uses **notes**:

- Notes are encrypted, off-chain data that only the owner can decrypt. Note hashes are committed to onchain
- To "update" private state, you consume (nullify) the old note and create a new one. The aztec-nr library handles the details
- You cannot iterate over notes or query them like a database

### Nullifiers Prevent Double-Spend

Nullifiers are unique identifiers computed from notes:

- When you spend a note, its nullifier is published on-chain
- The protocol rejects any transaction that reuses a nullifier

### Account Contracts Handle Auth

In Aztec, `msg_sender` exists but auth works differently:

- Users deploy their own **account contract** that defines their auth rules
- The account contract validates signatures, multisig, social recovery, etc.
- App contracts call `context.msg_sender()` but the actual auth happened in the account contract

### Private-to-Private Calls Compose in One Proof

- A private function calling another private function happens in the **same client-side transaction**
- No separate transaction or on-chain interaction needed
- The PXE composes all private calls into one proof before submission

## Contract Structure

### Basic Contract Template

```rust
use aztec::macros::aztec;

#[aztec]
pub contract MyContract {
    use aztec::state_vars::{Map, PublicMutable, PrivateSet, Owned};
    use aztec::protocol_types::address::AztecAddress;

    #[storage]
    struct Storage<Context> {
        // Public state (visible on-chain)
        admin: PublicMutable<AztecAddress, Context>,
        public_data: Map<AztecAddress, PublicMutable<Field, Context>, Context>,

        // Private state (encrypted, only visible to owners)
        // Owned replaces Map<AztecAddress, T> for per-user private storage
        private_data: Owned<PrivateSet<ValueNote, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }
}
```

## Function Types

### Private Functions

- Execute client-side in the PXE
- Can read/write private state
- Cannot directly read public state (must use oracles or enqueue public calls)
- Use `#[external("private")]` attribute

```rust
#[external("private")]
fn transfer(to: AztecAddress, amount: u128) {
    let from = self.msg_sender().unwrap();
    self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
    self.storage.balances.at(to).add(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
}
```

### Public Functions

- Execute on the Aztec sequencer
- Can read/write public state
- Visible to everyone
- Use `#[external("public")]` attribute

```rust
#[external("public")]
fn mint_public(to: AztecAddress, amount: Field) {
    assert(self.msg_sender().unwrap() == self.storage.admin.read());
    let current = self.storage.public_balances.at(to).read();
    self.storage.public_balances.at(to).write(current + amount);
}
```

### Internal Functions

- Only callable by the contract itself
- Use `#[only_self]` attribute

```rust
#[external("public")]
#[only_self]
fn _deduct_public_balance(owner: AztecAddress, amount: u64) {
    let balance = self.storage.public_balances.at(owner).read();
    assert(balance >= amount, "Insufficient balance");
    self.storage.public_balances.at(owner).write(balance - amount);
}
```

### View Functions

- Read-only, don't modify state
- Use `#[view]` attribute

```rust
#[external("public")]
#[view]
fn balance_of_public(owner: AztecAddress) -> Field {
    self.storage.public_balances.at(owner).read()
}
```

### Unconstrained (Utility) Functions

- Execute off-chain without proofs
- Used for reading private state
- Use `#[external("utility")]` attribute with `unconstrained` keyword

```rust
#[external("utility")]
unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
    self.storage.balances.at(owner).balance_of()
}
```

## Private <> Public Communication

### Calling Public from Private (Enqueue)

Private functions can enqueue public function calls that execute after the private portion:

```rust
#[external("private")]
fn public_to_private(amount: u64) {
    let sender = self.msg_sender().unwrap();
    // Enqueue public call
    self.enqueue_self._deduct_public_balance(sender, amount);
    // Continue with private logic
    self.storage.private_balances.at(sender).add(amount as u128);
}
```

### Cross-Contract Calls

```rust
// Call another contract's function
self.call(OtherContract::at(contract_address).some_function(args));

// Enqueue a public call to another contract
self.enqueue(OtherContract::at(contract_address).some_public_fn(args));
```

## State Variables

### Public State

- `PublicMutable<T, Context>`: Single mutable value
- `PublicImmutable<T, Context>`: Single immutable value (set once)
- `SharedMutable<T, Context>`: Value with delayed mutability for privacy

### Private State

All private state variables must be wrapped in `Owned`:

- `Owned<PrivateSet<Note, Context>, Context>`: Set of encrypted notes
- `Owned<PrivateMutable<Note, Context>, Context>`: Single encrypted note
- `Owned<PrivateImmutable<Note, Context>, Context>`: Single immutable encrypted note

### Maps

```rust
Map<Key, ValueType, Context>
```

## Notes (Private State)

Notes are encrypted data structures that represent private state:

```rust
use value_note::value_note::ValueNote;

// In storage
// Owned replaces Map<AztecAddress, T> for per-user private storage
balances: Owned<PrivateSet<ValueNote, Context>, Context>,

// Usage - for generic notes (PrivateSet)
self.storage.notes.at(owner).insert(note).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);  // Create note
self.storage.notes.at(owner).remove(note);  // Consume note

// For token balances, use BalanceSet instead (from balance_set library)
// self.storage.balances: Owned<BalanceSet<Context>, Context>
self.storage.balances.at(owner).add(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
self.storage.balances.at(owner).sub(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
```

## Testing Contracts

```rust
use aztec::{
    protocol_types::address::AztecAddress,
    test::helpers::test_environment::TestEnvironment,
};

#[test]
unconstrained fn test_my_contract() {
    let mut env = TestEnvironment::new();
    let owner = env.create_light_account();  // or env.create_contract_account() for authwit tests

    // Deploy contract
    let initializer = MyContract::interface().constructor(owner);
    let contract_address = env.deploy("MyContract").with_public_initializer(owner, initializer);

    // Call private function
    env.call_private(owner, MyContract::at(contract_address).some_private_function(args));

    // Call public function
    env.call_public(owner, MyContract::at(contract_address).some_public_function(args));

    // View public state (read-only)
    let result = env.view_public(MyContract::at(contract_address).get_value());
}
```

## Common Patterns

### Access Control

```rust
#[external("public")]
fn admin_only_function() {
    assert(self.msg_sender().unwrap() == self.storage.admin.read(), "Not admin");
    // ... function logic
}
```

### Ownership Check from Private

```rust
#[external("public")]
#[only_self]
fn _assert_is_owner(address: AztecAddress) {
    assert_eq(address, self.storage.owner.read(), "Not owner");
}

#[external("private")]
fn owner_action() {
    self.enqueue_self._assert_is_owner(self.msg_sender().unwrap());
    // If the above fails, the entire tx reverts
}
```

## Security Best Practices

1. **Never leak private data in public functions** - Public function args/returns are visible
2. **Use nullifiers properly** - Prevent double-spending of notes
3. **Validate all inputs** - Especially in public functions
4. **Be careful with msg_sender in private** - Use `.unwrap()` to ensure it's set
5. **Consider timing attacks** - Public state reads in private can leak information
6. **Test thoroughly** - Both unit tests and integration tests

### ⚠️ Critical: Note Ownership Constraints

**Only the owner of a note can nullify (spend/replace/delete) it.**

This is a common source of design bugs. Key rules:

- **Fields on notes are just data, not permissions** - Storing a `sender` address on a note does NOT allow the sender to modify that note
- **Notes are encrypted for the owner** - Non-owners cannot even see the note contents
- **If you need multi-party access** - Use public storage instead of notes

**Anti-Pattern (BROKEN):**

```rust
// Sender CANNOT actually cancel this - they don't own the note!
#[note]
struct StreamNote {
    sender: AztecAddress,  // This is just DATA, not a permission
    owner: AztecAddress,   // Only THIS address can nullify
}
```

**Correct Pattern:**

```rust
// Use public storage when multiple parties need access
streams: Map<Field, PublicMutable<StreamData, Context>, Context>,
```

See [Notes Pattern](./skills/aztec-developer/contract-dev/notes.md) for detailed guidance.

## Project Structure

```
project/
├── contracts/
│   └── my_contract/
│       ├── Nargo.toml
│       └── src/
│           └── main.nr
├── src/
│   └── index.ts      # TypeScript client code
├── tests/
│   └── my_contract.test.ts
└── package.json
```

## Dependencies in Nargo.toml

```toml
[package]
name = "my_contract"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
value_note = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "value-note" }
balance_set = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "balance-set" }
```

## Version Detection

**IMPORTANT: Before working on any Aztec project, detect the user's Aztec version.**

The Aztec API changes significantly between versions. Always check the version first:

### How to Detect Version

1. **Search for Nargo.toml files** in the user's project:

   ```
   Glob: **/Nargo.toml
   ```

2. **Extract the aztec dependency tag** from Nargo.toml:

   ```toml
   aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
   ```

   The version is the `tag` value (e.g., `v3.0.0-devnet.6-patch.1`).

3. **Remember the version** for the session and include it in Context7 queries.

### Version Context in Queries

When querying Context7, **always include the detected version** in your query string:

```
# Good - includes version context
query-docs: libraryId="/aztecprotocol/aztec-examples", query="PrivateSet storage pattern for Aztec v3.0.0-devnet.6"

# Bad - no version context
query-docs: libraryId="/aztecprotocol/aztec-examples", query="PrivateSet storage pattern"
```

### Version Mismatch Warning

If you detect a version different from `v3.0.0-devnet.6-patch.1` (the version this plugin is configured for):

- Warn the user that patterns in this guide may not match their version
- Prioritize Context7 documentation over the examples in this file
- Query with their specific version to get accurate syntax

### Quick Version Check Command

To quickly check a project's Aztec version:

```bash
grep -r "aztec.*tag" **/Nargo.toml 2>/dev/null | head -1
```

## Looking Up Latest Documentation

This plugin includes the Context7 MCP server for fetching up-to-date Aztec documentation.

### ⚠️ MANDATORY: Always Use Context7 For

**You MUST query Context7 before responding** when the user asks about:

1. **Library/API documentation** - Function signatures, parameters, return types
2. **Code generation** - Writing new contracts, functions, or TypeScript integrations
3. **Setup or configuration** - Project setup, Nargo.toml dependencies, toolchain config
4. **Syntax or patterns** - State variables, function attributes, note structures

This ensures users always get the most up-to-date information, even if it differs from examples in this guide.

### When to Use Context7

Use Context7 when:

- You need the latest API details that may have changed
- The user asks about features not covered in this guide
- You want to verify syntax or patterns are current
- You need working example contracts to reference

**How to use Context7 for Aztec:**

```
# Always include the detected version in your queries!
# Replace {VERSION} with the version from Nargo.toml (e.g., "v3.0.0-devnet.6")

# For reference implementations of common tasks (deployment, testing, TypeScript client)
query-docs: libraryId="/aztecprotocol/aztec-starter", query="deployment script for Aztec {VERSION}"

# For example contracts (RECOMMENDED for learning patterns)
query-docs: libraryId="/aztecprotocol/aztec-examples", query="token contract pattern Aztec {VERSION}"

# For official Aztec docs
query-docs: libraryId="/websites/aztec_network", query="PrivateSet storage Aztec {VERSION}"

# For monorepo source code and implementation details
query-docs: libraryId="/aztecprotocol/aztec-packages", query="MessageDelivery API Aztec {VERSION}"
```

**When to use which source:**

- `/aztecprotocol/aztec-starter` - **Reference implementations (53 snippets)** - Use for examples of deployment scripts, integration tests, TypeScript client code, devnet configuration, and other common development tasks
- `/aztecprotocol/aztec-examples` - **Example contracts and sample code (284 snippets)** - Use this FIRST when looking for contract patterns, implementations, or learning how to build specific features
- `/websites/aztec_network` - Official docs, tutorials, guides (7k+ snippets)
- `/aztecprotocol/aztec-packages` - Source code, implementation details (27k+ snippets)

**IMPORTANT:**

- When a user asks for examples, sample code, or "how do I implement X", always query `/aztecprotocol/aztec-examples` first before other sources.
- **Always include the user's Aztec version** (from their Nargo.toml) in Context7 queries to get version-appropriate documentation.

## Useful Resources

- Aztec Documentation: https://docs.aztec.network
- Noir Language: https://noir-lang.org
- Aztec GitHub: https://github.com/AztecProtocol/aztec-packages
