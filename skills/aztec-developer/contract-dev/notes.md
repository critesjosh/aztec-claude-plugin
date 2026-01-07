# Pattern: Notes (Private State)

## When to Use
Notes are the **only** way to store private state in Aztec. Use notes when data must be hidden from everyone except the owner.

## Mental Model
Notes are encrypted UTXOs stored in a Merkle tree. Each note:
- Is encrypted for a specific owner
- Can only be "spent" (nullified) by proving ownership
- Has randomness to prevent brute-force attacks on contents

When you "spend" a note, you emit a nullifier that marks it as consumed without revealing which note was used.

## Built-in Note Types

Use these before creating custom notes:

- **`UintNote`** - Stores a `U128` value with owner. Used by token balances.
- **`ValueNote`** - Stores a `Field` value with owner. General purpose.
- **`AddressNote`** - Stores an `AztecAddress`. Used for private address self.storage.

```rust
use dep::aztec::note::uint_note::UintNote;
// or
use dep::value_note::value_note::ValueNote;
```

## Defining Custom Notes

```rust
use aztec::{
    macros::notes::note,
    protocol_types::{address::AztecAddress, traits::Packable},
};

#[derive(Eq, Packable)]
#[note]
pub struct MyNote {
    // Your data
    data: Field,
    amount: u64,
    // Required fields
    owner: AztecAddress,
    randomness: Field,
}
```

The `#[note]` macro auto-implements `NoteHash` and `NullifiableNote` traits.

## Working with Notes

### Insert
```rust
let note = UintNote::new(amount, owner);
self.storage.notes.at(owner).insert(note).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
```

### Get and Remove
```rust
let options = NoteGetterOptions::new();
let notes = self.storage.notes.at(owner).get_notes(options);
let note = notes.get(0);
self.storage.notes.at(owner).remove(note);
```

## Note Emission (MessageDelivery)

When inserting notes, you must emit them so the recipient can discover them:

- **`CONSTRAINED_ONCHAIN`** - Siloed to contract, included in proof. Most secure. Use for value transfers.
- **`UNCONSTRAINED_ONCHAIN`** - Posted on-chain but not in proof. Cheaper. Use for non-critical notes.
- **`UNCONSTRAINED_OFFCHAIN`** - Not posted on-chain. Recipient must be online. Cheapest.

## Reference
`token_contract` - `UintNote` for balances
`value_note` library - `ValueNote` implementation
