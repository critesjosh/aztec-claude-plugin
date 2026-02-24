# Data Types

Comprehensive guide to data types in Aztec Noir contracts.

## Primitive Numeric Types

| Type    | Size     | Range                | Use Case              |
| ------- | -------- | -------------------- | --------------------- |
| `u8`    | 8 bits   | 0 to 255             | Flags, small counters |
| `u32`   | 32 bits  | 0 to ~4.3 billion    | Timestamps, indices   |
| `u64`   | 64 bits  | 0 to ~18 quintillion | Large counters        |
| `u128`  | 128 bits | Very large           | **Token amounts**     |
| `Field` | 254 bits | Finite field element | Hashes, identifiers   |

### Token Amounts: Always Use u128

```rust
// GOOD: u128 prevents overflow with large token supplies
fn transfer(amount: u128) { ... }

// BAD: u64 can overflow
fn transfer(amount: u64) { ... }  // Don't do this
```

**Why u128?** A token with 18 decimals and 1 billion supply needs:

- `1_000_000_000 * 10^18` = requires more than 64 bits

## Field Type

`Field` is Aztec's native 254-bit prime field element. Use for:

- Cryptographic hashes
- Nullifiers
- Unique identifiers
- Note commitments

```rust
use aztec::protocol::traits::ToField;

let hash: Field = some_value.to_field();
let id: Field = Fr::random();  // In tests
```

### Field Limitations

- Cannot compare with `<` or `>` directly (use `lt`, `gt` methods)
- Arithmetic wraps around the field modulus
- Not suitable for amounts that need overflow checking

## Address Types

### AztecAddress

32-byte address for Aztec contracts and accounts.

```rust
use aztec::protocol::address::AztecAddress;

// In storage
owner: PublicMutable<AztecAddress, Context>,

// Conversions
let addr_field: Field = address.to_field();
let addr_back = AztecAddress::from_field(addr_field);

// Zero address check
assert(!address.is_zero(), "Invalid address");
```

### EthAddress

20-byte Ethereum address for L1 interactions.

```rust
use aztec::protocol::address::EthAddress;

// For portal contracts, L1 bridges
l1_contract: PublicImmutable<EthAddress, Context>,

// Conversions
let eth_field: Field = eth_address.to_field();
```

## String Handling

### Fixed-Size Strings (Parameters)

Use `str<N>` for function parameters:

```rust
#[external("public")]
fn set_name(name: str<32>) {
    // Process fixed-size string
}
```

### FieldCompressedString (Storage)

For storing strings in public state efficiently:

```rust
use compressed_string::FieldCompressedString;

#[storage]
struct Storage<Context> {
    name: PublicImmutable<FieldCompressedString, Context>,
    symbol: PublicImmutable<FieldCompressedString, Context>,
}

#[external("public")]
#[initializer]
fn constructor(name: str<31>, symbol: str<31>) {
    // Compress strings for storage (max 31 bytes)
    self.storage.name.initialize(FieldCompressedString::from_string(name));
    self.storage.symbol.initialize(FieldCompressedString::from_string(symbol));
}

#[external("public")]
#[view]
fn get_name() -> FieldCompressedString {
    self.storage.name.read()
}
```

**Nargo.toml dependency:**

```toml
compressed_string = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v4.0.0-devnet.2-patch.1", directory = "compressed-string" }
```

## Custom Structs

### Basic Struct

Custom structs need specific trait derivations:

```rust
use aztec::protocol::traits::{Deserialize, Serialize, Packable};

#[derive(Eq, Serialize, Deserialize, Packable)]
struct UserData {
    balance: u128,
    last_update: u64,
    active: bool,
}
```

### Required Traits

| Trait         | Purpose                   |
| ------------- | ------------------------- |
| `Eq`          | Equality comparison       |
| `Serialize`   | Convert to field array    |
| `Deserialize` | Convert from field array  |
| `Packable`    | Storage packing/unpacking |

### Struct in Storage

```rust
#[storage]
struct Storage<Context> {
    user_data: Map<AztecAddress, PublicMutable<UserData, Context>, Context>,
}

// Usage
let data = self.storage.user_data.at(user).read();
self.storage.user_data.at(user).write(UserData {
    balance: 100,
    last_update: 12345,
    active: true,
});
```

## Notes (Private State)

Notes are encrypted data for private state. Two macros are available:

**`#[note]`** - Simple notes (macro generates `NoteHash` implementation):

```rust
use aztec::{macros::notes::note, protocol::traits::{Deserialize, Packable, Serialize}};

#[derive(Deserialize, Eq, Packable, Serialize)]
#[note]
pub struct FieldNote {
    pub value: Field,
}
```

The `#[note]` macro automatically handles owner, storage_slot, and randomness - you only define your data fields.

**How ownership works:** The `Owned<>` wrapper handles ownership, not the note struct:

```rust
// In storage
balances: Owned<PrivateSet<UintNote, Context>, Context>,

// Usage - owner is passed via .at(), flows to note hash computation
self.storage.balances.at(owner).add(amount)
//                      ↑
//                      Owner passed here, flows to:
//                      NoteHash::compute_note_hash(self, owner, storage_slot, randomness)
```

The `Owned` wrapper:
- Provides `.at(owner)` to access a specific owner's state
- Passes owner down to note hash/nullifier computation
- Ensures only the owner can decrypt and nullify their notes

**`#[custom_note]`** - Advanced notes (you implement `NoteHash` trait):

```rust
use aztec::note::note_interface::NoteHash;

#[derive(Deserialize, Eq, Serialize, Packable)]
#[custom_note]
pub struct UintNote {
    pub value: u128,
}

// You implement NoteHash trait yourself
impl NoteHash for UintNote {
    fn compute_note_hash(
        self,
        owner: AztecAddress,      // Passed by system
        storage_slot: Field,      // Passed by system
        randomness: Field,        // Passed by system
    ) -> Field {
        // Custom hash computation for partial note support
        poseidon2_hash_with_separator(
            [owner.to_field(), storage_slot, randomness, self.value.to_field()],
            GENERATOR_INDEX__NOTE_HASH,
        )
    }

    fn compute_nullifier(self, context, owner, note_hash) -> Field { ... }
}
```

**When to use `#[custom_note]`:**

- Need **partial notes** (create in private, complete in public)
- Need custom hash/nullifier computation
- Used by `UintNote` and `NFTNote` for partial note support

### Built-in Note Types

**UintNote** is the standard note type for numeric values:

```rust
use uint_note::uint_note::UintNote;

// UintNote stores a u128 value
pub struct UintNote {
    pub value: u128,
}
```

**BalanceSet** wraps UintNote for token balances with add/sub helpers:

```rust
use balance_set::BalanceSet;

// In storage - BalanceSet uses UintNote internally
balances: Owned<BalanceSet<Context>, Context>,

// Usage
self.storage.balances.at(owner).add(amount).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
self.storage.balances.at(owner).sub(amount).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

See [Notes](./notes.md) for detailed note patterns.

## BoundedVec

Fixed-capacity vector for bounded collections:

```rust
use std::collections::bounded_vec::BoundedVec;

// Create with max capacity
let mut items: BoundedVec<Field, 10> = BoundedVec::new();

// Add items
items.push(value1);
items.push(value2);

// Access
let first = items.get(0);
let length = items.len();

// Iterate
for i in 0..items.len() {
    let item = items.get(i);
}
```

### In Function Parameters

```rust
#[external("public")]
fn process_batch(items: BoundedVec<Field, 10>) {
    for i in 0..items.len() {
        // Process each item
    }
}
```

## Maps

Maps associate keys with values:

```rust
use aztec::state_vars::Map;

#[storage]
struct Storage<Context> {
    // Single-level map
    balances: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

    // Nested map (e.g., allowances[owner][spender])
    allowances: Map<AztecAddress, Map<AztecAddress, PublicMutable<u128, Context>, Context>, Context>,
}

// Usage
let balance = self.storage.balances.at(user).read();
let allowance = self.storage.allowances.at(owner).at(spender).read();
```

## Custom Packable for Large Data

When data exceeds 31 bytes per field (e.g., ECDSA public keys), implement custom `Packable`:

```rust
use aztec::protocol::traits::Packable;

// 64-byte ECDSA public key (needs 3 fields)
struct ECDSAPublicKey {
    x: [u8; 32],
    y: [u8; 32],
}

impl Packable<3> for ECDSAPublicKey {
    fn pack(self) -> [Field; 3] {
        // Pack 32 bytes into each of first two fields
        // Use third field for any overflow
        let x_field = bytes_to_field(self.x);
        let y_field = bytes_to_field(self.y);
        [x_field, y_field, 0]
    }

    fn unpack(fields: [Field; 3]) -> Self {
        let x = field_to_bytes(fields[0]);
        let y = field_to_bytes(fields[1]);
        ECDSAPublicKey { x, y }
    }
}
```

## Type Conversions

### To/From Field

```rust
use aztec::protocol::traits::ToField;

// To Field
let field_value: Field = address.to_field();
let field_from_u128: Field = amount as Field;

// From Field
let addr = AztecAddress::from_field(field_value);
```

### Address Conversions

```rust
// AztecAddress <-> Field
let field = address.to_field();
let address = AztecAddress::from_field(field);

// Zero check
if address.is_zero() { ... }
```

### Numeric Conversions

```rust
// Safe casting (same or larger type)
let bigger: u128 = smaller_u64 as u128;

// Field to numeric (be careful with large values)
let numeric = field_value as u128;  // May truncate
```

## Best Practices

1. **Use `u128` for token amounts** - prevents overflow
2. **Use `Field` for identifiers and hashes** - native to the proof system
3. **Use `FieldCompressedString` for stored strings** - efficient storage
4. **Always include `owner` in notes** - required for nullification
5. **Check for zero addresses** - prevent invalid transfers
6. **Use `BoundedVec` for arrays** - required for known-size collections
7. **Derive all required traits** for custom structs used in storage
