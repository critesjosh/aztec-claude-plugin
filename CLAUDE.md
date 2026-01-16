# Aztec Development Guidelines

This project uses the Aztec Network for privacy-preserving smart contract development. Follow these guidelines when working with Aztec contracts and applications.

## Technology Stack

- **Noir**: Domain-specific language for writing Aztec smart contracts
- **Aztec.nr**: Noir framework for Aztec contract development
- **aztec-cli**: Command-line tool for deployment and interaction
- **PXE (Private Execution Environment)**: Client-side execution for private functions

## Contract Structure

### Basic Contract Template

```rust
#[aztec]
contract MyContract {
    use dep::aztec::macros::aztec;
    use dep::aztec::state_vars::{Map, PublicMutable, PrivateSet, Owned};
    use dep::aztec::types::AztecAddress;

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

### Unconstrained Functions

- Execute off-chain without proofs
- Used for reading private state
- Use `unconstrained` keyword

```rust
#[external("private")]
unconstrained fn balance_of_private(owner: AztecAddress) -> Field {
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
use dep::value_note::value_note::ValueNote;

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
use dep::aztec::test::helpers::test_environment::TestEnvironment;

#[test]
fn test_my_contract() {
    let mut env = TestEnvironment::new();

    // Deploy contract
    let deployer = env.deploy("MyContract");
    let initializer = MyContract::interface().constructor(admin);
    let contract_address = deployer.with_public_initializer(admin, initializer);

    // Interact with contract
    let contract = MyContract::at(contract_address);
    contract.some_function(args).call(&mut env.private());
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
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.XX.X", directory = "noir-projects/aztec-nr/aztec" }
value_note = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.XX.X", directory = "noir-projects/aztec-nr/value-note" }
```

## Looking Up Latest Documentation

This plugin includes the Context7 MCP server for fetching up-to-date Aztec documentation. Use it when:
- You need the latest API details that may have changed
- The user asks about features not covered in this guide
- You want to verify syntax or patterns are current
- You need working example contracts to reference

**How to use Context7 for Aztec:**

```
# For example contracts (RECOMMENDED for learning patterns)
query-docs: libraryId="/aztecprotocol/aztec-examples", query="<specific pattern or contract type>"

# For official Aztec docs
query-docs: libraryId="/websites/aztec_network", query="<specific question>"

# For monorepo source code and implementation details
query-docs: libraryId="/aztecprotocol/aztec-packages", query="<specific question>"
```

**When to use which source:**
- `/aztecprotocol/aztec-examples` - **Example contracts and sample code (284 snippets)** - Use this FIRST when looking for contract patterns, implementations, or learning how to build specific features
- `/websites/aztec_network` - Official docs, tutorials, guides (7k+ snippets)
- `/aztecprotocol/aztec-packages` - Source code, implementation details (27k+ snippets)

**IMPORTANT:** When a user asks for examples, sample code, or "how do I implement X", always query `/aztecprotocol/aztec-examples` first before other sources.

## Useful Resources

- Aztec Documentation: https://docs.aztec.network
- Noir Language: https://noir-lang.org
- Aztec GitHub: https://github.com/AztecProtocol/aztec-packages
