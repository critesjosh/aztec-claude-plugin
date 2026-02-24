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
    let sender = self.msg_sender();
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
| Escrow with refund capability | ❌ | ✅ |

### Privacy-Preserving Alternatives

Before defaulting to public storage, consider these patterns that preserve privacy:

#### Dual Emission Pattern

Emit the same note to multiple recipients. Both parties can **see** the note, but only the owner can **nullify** it:

```rust
// Create note owned by recipient
let note = StreamNote::new(amount, recipient);
self.storage.streams.at(recipient).insert(note);

// Emit to both parties - both can see it, only recipient can nullify
self.emit(note, recipient, MessageDelivery.ONCHAIN_CONSTRAINED);  // Owner - can see and nullify
self.emit(note, sender, MessageDelivery.ONCHAIN_CONSTRAINED);     // Can see, cannot nullify
```

**Use case:** Sender needs visibility into note state but doesn't need to modify it.

#### Shared Nullifier Key Pattern

Include the nullifier key directly in the note, allowing any party who can read the note to nullify it:

```rust
#[note]
pub struct SharedNote {
    amount: u128,
    nullifier_key: Field,  // Shared secret - anyone with this can nullify
    owner: AztecAddress,
}

// Either party can nullify if they know the nullifier_key
#[external("private")]
fn cancel(note: SharedNote) {
    // Prove knowledge of nullifier_key to nullify
    let nullifier = poseidon2_hash([note.nullifier_key, note.randomness]);
    self.context.push_nullifier(nullifier);
    // ...
}
```

**Use case:** True multi-party control where either party can consume the note.

#### Pre-Signed Authorization Pattern

Embed a cryptographic authorization in the note at creation time. The non-owner signs a message authorizing specific actions, and this signature is stored in the note. Later, anyone can trigger the authorized action by proving the signature is valid.

**Key insight:** The note owner still performs the nullification, but they're cryptographically authorized to do so by the non-owner's signature. This proves "the sender wanted this action to happen."

**How it works:**

1. **At creation:** The sender generates a signature authorizing a specific action (e.g., cancellation)
2. **Storage:** The signature and sender's public key are stored in the note itself
3. **Trigger:** Anyone can call the cancel function and provide proof they know the authorization exists
4. **Verification:** The contract verifies the signature matches the sender's public key
5. **Execution:** The owner's note is nullified, with the authorization proving legitimacy

```rust
#[note]
pub struct AuthorizedStreamNote {
    amount: u128,
    sender: AztecAddress,
    cancel_authorization: [Field; 2],  // Sender's signature authorizing cancellation
    owner: AztecAddress,               // Recipient - only they can nullify
}

// Sender creates note with embedded cancel authorization
#[external("private")]
fn create_stream(recipient: AztecAddress, amount: u128) {
    let sender = self.msg_sender();
    let stream_id = compute_stream_id(sender, recipient, amount);

    // Sender signs: "I authorize cancellation of stream {stream_id}"
    let cancel_message = poseidon2_hash([CANCEL_SELECTOR, stream_id]);
    let cancel_auth = self.context.request_nsk_app(cancel_message);  // Or use schnorr signing

    let note = AuthorizedStreamNote::new(
        amount,
        sender,
        cancel_auth,
        recipient  // Recipient owns the note
    );

    // Emit to both parties so sender can later prove the authorization exists
    self.storage.streams.at(recipient).insert(note);
    self.emit(note, sender, MessageDelivery.ONCHAIN_CONSTRAINED);
    self.emit(note, recipient, MessageDelivery.ONCHAIN_CONSTRAINED);
}

// Cancel function - can be called by sender
#[external("private")]
fn cancel_stream(stream_id: Field, recipient: AztecAddress) {
    let sender = self.msg_sender();

    // Sender reads their copy of the note (via dual emission)
    let note = self.storage.streams.at(recipient).get_note();

    // Verify this is the sender's stream
    assert(note.sender == sender, "Not stream sender");

    // Verify the cancel authorization is valid
    let cancel_message = poseidon2_hash([CANCEL_SELECTOR, stream_id]);
    assert(verify_signature(sender, cancel_message, note.cancel_authorization));

    // Enqueue public call to mark stream cancelled
    // (Recipient's note remains, but public state prevents withdrawal)
    self.enqueue_self._mark_cancelled(stream_id);
}

// Alternative: Recipient processes cancellation on sender's behalf
#[external("private")]
fn process_cancellation(stream_id: Field) {
    let recipient = self.msg_sender();

    // Recipient owns the note, so they can nullify it
    let note = self.storage.streams.at(recipient).pop_note();

    // Verify cancel was authorized by sender
    let cancel_message = poseidon2_hash([CANCEL_SELECTOR, stream_id]);
    assert(verify_signature(note.sender, cancel_message, note.cancel_authorization));

    // Return funds to sender (recipient nullifies, but authorization proves sender wanted this)
    self.call(Token::at(token).transfer(note.sender, note.amount));
}
```

**Important considerations:**

- The authorization is **fixed at creation time** - you can't add new authorizations later
- The sender can see the note (via dual emission) but still cannot nullify it
- Works best when the set of authorized actions is known upfront
- For dynamic authorizations, combine with public state to track authorization status

**When to use this instead of authwit:**

Aztec has a built-in authentication witness (authwit) system. Choose pre-signed authorization over authwit when:

| Pre-Signed Authorization | Authwit |
|--------------------------|---------|
| **Irrevocability is a feature** - recipient can trust the authorization won't disappear | Authorizer can revoke at any time |
| **No callback to authorizer's account** - works even if authorizer's account is compromised | Requires authorizer's account contract to verify |
| **Atomic creation** - authorization created simultaneously with the note, no race conditions | Authwit may be created separately, timing issues possible |
| **Authorization is private** - embedded in encrypted note | Authwit storage may have different privacy characteristics |
| **Known upfront** - all possible authorizations determined at creation | **Dynamic** - authorizations can be added/removed over time |

**Example scenario:** A payment stream where the sender commits to allowing cancellation. Using authwit, the sender could revoke the cancellation auth after the stream starts, trapping the recipient. With pre-signed authorization embedded in the note, the recipient has cryptographic proof that cancellation was authorized at creation - it cannot be revoked.

**Use case:** Escrow, streams, or any pattern where irrevocable commitment to specific actions is required at creation time.

## Built-in Note Types

Use these before creating custom notes:

- **`UintNote`** - Stores a `U128` value with owner. Used by token balances.
- **`PartialUintNote`** - Partially constructed `UintNote` for partial notes flow. Used with `complete` to finalize.
- **`ValueNote`** - Stores a `Field` value with owner. General purpose.
- **`AddressNote`** - Stores an `AztecAddress`. Used for private address storage.

```rust
use uint_note::UintNote;
use uint_note::PartialUintNote;
// or
use value_note::value_note::ValueNote;
```

## Defining Custom Notes

```rust
use aztec::{
    macros::notes::note,
    protocol::{address::AztecAddress, traits::Packable},
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
self.storage.notes.at(owner).insert(note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
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

- **`ONCHAIN_CONSTRAINED`** - Siloed to contract, included in proof. Most secure. Use for value transfers.
- **`ONCHAIN_UNCONSTRAINED`** - Posted on-chain but not in proof. Cheaper. Use for non-critical notes.
- **`OFFCHAIN`** - Not posted on-chain. Recipient must be online. Cheapest.

## Reference
`token_contract` - `UintNote` for balances
`value_note` library - `ValueNote` implementation
