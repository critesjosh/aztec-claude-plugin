# Pattern: Notes (Private State)

## When to Use
Notes are the **only** way to store private state in Aztec. Use notes when data must be hidden from everyone except the owner.

## Mental Model
Notes are encrypted UTXOs stored in a Merkle tree. Each note:
- Is encrypted for a specific owner
- Can only be "spent" (nullified) by proving ownership
- Has randomness to prevent brute-force attacks on contents

When you "spend" a note, you emit a nullifier that marks it as consumed without revealing which note was used.

## ⚠️ CRITICAL: Note Ownership and Nullification

**Only the owner of a note can nullify (consume/replace/delete) it.**

This is a fundamental constraint that causes many design bugs. Common mistakes:

### ❌ Anti-Pattern: "Cancellation" Fields on Notes

```rust
// BROKEN DESIGN - sender cannot actually cancel this note!
#[note]
pub struct StreamNote {
    sender: AztecAddress,     // ← This is just DATA, not a permission!
    recipient: AztecAddress,  // ← This is the owner
    amount: u128,
    owner: AztecAddress,      // = recipient (only they can nullify)
}
```

**Why this fails:** The `sender` field is just stored data. It does NOT grant the sender any ability to:
- See the note (it's encrypted for the recipient's keys)
- Nullify the note (only the owner can do this)
- Replace the note (requires nullifying first)

If a sender creates a note owned by the recipient, **the sender loses all control over that note**.

### ✅ Correct Pattern: Public Registry for Shared State

When multiple parties need to modify state (e.g., sender can cancel, recipient can withdraw), use **public storage** for the shared state:

```rust
#[storage]
struct Storage {
    // Stream data stored publicly - both parties can access
    streams: Map<Field, PublicMutable<StreamData, Context>, Context>,
}

// Now sender CAN cancel because data is public
#[external("private")]
fn cancel_stream(stream_id: Field) {
    let sender = self.msg_sender().unwrap();
    // Validate in public, where both parties can access the data
    self.enqueue(Self::at(this).process_cancellation_public(stream_id, sender));
}
```

**Privacy tradeoff:** Stream existence and parameters become public, but token balances remain private.

### Design Decision Guide

| Scenario | Use Notes (Private) | Use Public Storage |
|----------|--------------------|--------------------|
| Only owner ever modifies state | ✅ | ❌ |
| Multiple parties can modify | ❌ | ✅ |
| State must be hidden from everyone | ✅ | ❌ |
| Non-owner needs "cancel" ability | ❌ | ✅ |
| Escrow with refund capability | ❌ | ✅ (or contract-owned notes) |

### Alternative: Contract-Owned Notes

If you need an escrow where the contract controls funds:

```rust
// Note owned by the CONTRACT, not a user
let note = UintNote::new(amount, this_contract_address);
self.storage.escrow.at(this_contract_address).insert(note)
    .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
```

The contract can then define rules for who can trigger releases via public functions.

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
