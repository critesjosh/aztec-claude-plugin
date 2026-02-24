# Pattern: State Variables

## Mental Model
State variables in Aztec are either **public** (on-chain, readable by anyone) or **private** (stored as encrypted notes, only accessible to owners). This manifest explains all of your options, but does not explain HOW to use them. You need to use the Aztec MCP server to see how to actually implement them.

## Index
- `PublicMutable<T>` - Public, read/write. Counters, balances, flags.
- `PublicImmutable<T>` - Public, write-once. Config, token metadata, admin.
- `Owned<PrivateMutable<T>>` - Private, single replaceable note. User settings. Must be wrapped in Owned.
- `Owned<PrivateImmutable<T>>` - Private, write-once. Signing keys, secrets. Must be wrapped in Owned.
- `Owned<PrivateSet<T>>` - Private, add/remove notes. Token balances, collections. Must be wrapped in Owned.
- `DelayedPublicMutable<T>` - Public writes, public/ private reads. Has special rules around access
- `Map<K, V>` - Wraps other types. Per-user storage, mappings.

## Storage Types:

### `PublicMutable<T>`
Standard mutable public storage.

### `PublicImmutable<T>`
Set once during initialization, readable forever in both private and public contexts. Good for configurations that will never change and need to be read potentially in private context.

### `Owned<PrivateMutable<T>>`
Single private note that can be replaced. Must be wrapped in `Owned` when stored. If you read PrivateMutable in private context and don't intend on replacing the note, you must re-emit the note if using constrained emission.

### `Owned<PrivateImmutable<T>>`
Single private note, set once. Must be wrapped in `Owned` when stored. Much like PublicImmutable except used when public data leakage is unacceptable.

### `Owned<PrivateSet<T>>`
Collection of private notes. Must be wrapped in `Owned` when stored. Consider like a wallet - if you own $30, you may have 5 $1 bills, 1 $5 bill, and 2 $10 bills. Your total balance is 30 by using multiple notes in your set (wallet).

### `Map<K, V>`
Key-value mapping, wraps other state var types.

### `DelayedPublicMutable<T, DELAY>`
Public state that private functions can read with stability guarantees. Changes are scheduled and take effect after DELAY seconds. If you want to use DelayedPublicMutable, check [delayed-public-mutable.md](./delayed-public-mutable.md) for details first.

## Note Emission
Private state changes require emitting notes with `MessageDelivery`:
- `ONCHAIN_CONSTRAINED` - Encryption verified in circuit, logged on-chain
- `ONCHAIN_UNCONSTRAINED` - Encryption not verified, logged on-chain (cheaper)

### SinglePrivateMutable

A private state variable that holds exactly one note that can be replaced. Used when you need a single mutable value per owner (e.g., a signing key).

```rust
use aztec::state_vars::SinglePrivateMutable;
use address_note::AddressNote;

#[storage]
struct Storage<Context> {
    admin: SinglePrivateMutable<AddressNote, Context>,
}

// Initialize (can only be called once)
self.storage.admin.initialize(note);

// Replace the stored note
self.storage.admin.replace(new_note);

// Read in unconstrained context
let note = self.storage.admin.view_note();
```

### SinglePrivateImmutable

A private state variable that holds exactly one note that can never be changed after initialization. Used for permanent private data like account signing keys.

```rust
use aztec::state_vars::SinglePrivateImmutable;
use public_key_note::PublicKeyNote;

#[storage]
struct Storage<Context> {
    signing_public_key: SinglePrivateImmutable<PublicKeyNote, Context>,
}

// Initialize once (subsequent calls will fail)
self.storage.signing_public_key.initialize(note);

// Read the immutable note
let note = self.storage.signing_public_key.get_note();
```

### SingleUseClaim

A state variable that can be claimed exactly once per owner. Must be wrapped in `Owned` inside a `Map`. Used for voting, one-time claims, etc.

```rust
use aztec::state_vars::{Map, Owned, SingleUseClaim};

#[storage]
struct Storage<Context> {
    claims: Map<ElectionId, Owned<SingleUseClaim<Context>, Context>, Context>,
}

// Claim (will fail if already claimed by this owner)
self.storage.claims.at(election_id).claim();
```
