# Pattern: Contract Structure

## Basic Template

```rust
use dep::aztec::macros::aztec;

#[aztec]
pub contract MyContract {
    use dep::aztec::{
        macros::{
            functions::{external, initializer, internal, view},
            storage::storage,
        },
        protocol_types::address::AztecAddress,
        state_vars::{PublicMutable, Map},
    };

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }
}
```

## The `#[aztec]` Macro
Wraps the entire contract. Provides the `context` and `storage` variables automatically.

## The `#[storage]` Macro
Defines contract storage. Always uses `<Context>` generic. See [storage.md](./storage.md) for state variable types.

## Initializers

### Single initializer
```rust
#[external("public")]  // or "private"
#[initializer]
fn constructor(args: Field) { ... }
```

### Multiple initializers
A contract can have multiple initializer functions - only one can ever be called:
```rust
#[external("public")]
#[initializer]
fn init_with_admin(admin: AztecAddress) { ... }

#[external("private")]
#[initializer]
fn init_with_key(signing_key: Field) { ... }
```

### `#[noinitcheck]`
By default, all functions check the contract is initialized before running. This skips that check - allowing the function to be called before initialization or as an optimization.
```rust
#[external("private")]
#[noinitcheck]
fn entrypoint(...) { ... }  // Account contracts use this - entrypoint must work immediately
```

## Function Annotations

### `#[external("public")]`
Executes on-chain. Can read/write public state. Cannot access private state.
```rust
#[external("public")]
fn set_admin(new_admin: AztecAddress) {
    self.storage.admin.write(new_admin);
}
```

### `#[external("private")]`
Executes client-side, generates proof. Can access private notes and public immutable state.
```rust
#[external("private")]
fn transfer(to: AztecAddress, amount: u128) {
    let from = self.msg_sender().unwrap();
    // ... work with private notes
}
```

### `#[external("utility")]`
Unconstrained function - no proof generated. For read-only queries. Must use `unconstrained` keyword.
```rust
#[external("utility")]
unconstrained fn get_balance(owner: AztecAddress) -> u128 {
    self.storage.balances.at(owner).balance_of()
}
```

### `#[internal]`
Only callable by the contract itself. Used for private→public patterns.
```rust
#[external("public")]
#[internal]
fn _increase_balance(to: AztecAddress, amount: u128) {
    // Only this contract can call this
}
```

### `#[view]`
Indicates function doesn't modify state. Works with public, private, or utility.
```rust
#[external("public")]
#[view]
fn get_admin() -> AztecAddress {
    self.storage.admin.read()
}
```

## Common Imports

```rust
use dep::aztec::{
    // Macros
    macros::{
        aztec,
        functions::{external, initializer, internal, view, noinitcheck},
        storage::storage,
        events::event,
    },
    // Context types
    context::{PrivateContext, PublicContext},
    // Protocol types
    protocol_types::{address::AztecAddress, traits::ToField},
    // State variables (private types must be wrapped in Owned)
    state_vars::{PublicMutable, PublicImmutable, PrivateSet, PrivateImmutable, PrivateMutable, Map, Owned},
    // Notes
    note::note_getter_options::NoteGetterOptions,
    // Messages
    messages::message_delivery::MessageDelivery,
};
```

## Reference
`counter_contract` - minimal example, `token_contract` - full-featured example
