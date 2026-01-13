# Devnet Syntax Reference

This document contains the canonical syntax for Aztec devnet (latest development version).

## Function Attributes

### Private Functions
```rust
#[external("private")]
fn transfer(to: AztecAddress, amount: u128) {
    // Client-side execution, generates proof
}
```

### Public Functions
```rust
#[external("public")]
fn mint(to: AztecAddress, amount: u128) {
    // On-chain execution
}
```

### Initializers
```rust
#[external("public")]
#[initializer]
fn constructor(admin: AztecAddress) {
    self.storage.admin.write(admin);
}
```

### View Functions
```rust
#[external("public")]
#[view]
fn get_balance(owner: AztecAddress) -> Field {
    self.storage.balances.at(owner).read()
}
```

### Internal Functions
```rust
#[external("public")]
#[internal]
fn _increase_balance(owner: AztecAddress, amount: u128) {
    // Only callable by this contract
}
```

### Unconstrained Functions
```rust
#[external("utility")]
unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
    self.storage.balances.at(owner).balance_of()
}
```

## Storage Patterns

### Private State (requires Owned wrapper)
```rust
#[storage]
struct Storage<Context> {
    // Private state MUST be wrapped in Owned
    balances: Owned<PrivateSet<ValueNote, Context>, Context>,
    user_data: Owned<PrivateMutable<DataNote, Context>, Context>,
    secrets: Owned<PrivateImmutable<SecretNote, Context>, Context>,

    // Public state - no wrapper needed
    admin: PublicMutable<AztecAddress, Context>,
    total_supply: PublicMutable<u128, Context>,
}
```

### Map with Owned
```rust
// Per-user private balances
balances: Map<AztecAddress, Owned<PrivateSet<ValueNote, Context>, Context>, Context>,
```

## Note Delivery

Private state changes require explicit MessageDelivery:

```rust
// Constrained - encryption verified in circuit (more secure)
self.storage.balances.at(owner).add(amount).deliver(MessageDelivery::CONSTRAINED_ONCHAIN);

// Unconstrained - encryption not verified (cheaper)
self.storage.balances.at(owner).add(amount).deliver(MessageDelivery::UNCONSTRAINED_ONCHAIN);
```

## Cross-Contract Calls

### Call from Private
```rust
#[external("private")]
fn call_other_contract(target: AztecAddress) {
    // Synchronous call to another private function
    OtherContract::at(target).private_function(args).call(&mut self.context);
}
```

### Enqueue Public from Private
```rust
#[external("private")]
fn shield_tokens(amount: u64) {
    let sender = self.msg_sender().unwrap();
    // Enqueue public call to execute after private portion
    self.enqueue_self._deduct_public_balance(sender, amount);
    // Continue with private logic
    self.storage.balances.at(sender).add(amount as u128).deliver(MessageDelivery::CONSTRAINED_ONCHAIN);
}
```

## Common Imports

```rust
use dep::aztec::{
    macros::{
        aztec,
        functions::{external, initializer, internal, view, noinitcheck},
        storage::storage,
        events::event,
    },
    protocol_types::{address::AztecAddress, traits::ToField},
    state_vars::{PublicMutable, PublicImmutable, PrivateSet, PrivateImmutable, PrivateMutable, Map, Owned},
    messages::message_delivery::MessageDelivery,
    note::note_getter_options::NoteGetterOptions,
};
```

## Dependencies (Nargo.toml)

```toml
[package]
name = "my_contract"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.87.4-devnet.0", directory = "noir-projects/aztec-nr/aztec" }
value_note = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.87.4-devnet.0", directory = "noir-projects/aztec-nr/value-note" }
```

Replace the tag with your target devnet version. All aztec-packages dependencies should use the same tag.
