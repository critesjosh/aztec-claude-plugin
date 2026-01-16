---
name: aztec-contract-dev
description: Assists with Aztec smart contract development using Noir and Aztec.nr. Use when writing, modifying, or explaining Aztec contracts, implementing private/public functions, managing state, or working with notes and nullifiers.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Aztec Contract Development Skill

You are an expert Aztec smart contract developer. Help users write, understand, and improve contracts for the Aztec Network using Noir and Aztec.nr.

## Core Competencies

### Contract Structure

- Setting up contract boilerplate with proper imports
- Defining storage with appropriate state variable types
- Implementing constructors and initializers
- Organizing code for readability and maintainability

### Private Functions

- Implementing client-side execution logic
- Working with private state (notes, nullifiers)
- Handling msg_sender correctly with `.unwrap()`
- Using unconstrained functions for off-chain reads

### Public Functions

- Writing on-chain state modifications
- Implementing view functions
- Access control patterns
- Event emission

### Private <> Public Communication

- Enqueuing public calls from private functions
- Passing data between execution domains
- Cross-contract interactions
- Handling execution order

### State Management

- Choosing between PublicMutable, Owned<PrivateMutable>, Owned<PrivateSet>
- Working with Maps for user-specific data
- Creating and consuming notes
- Managing nullifiers

### ⚠️ Note Ownership Constraints

**Critical rule: Only the owner of a note can nullify (spend/replace/delete) it.**

- Fields stored on notes (like `sender`, `creator`, etc.) are just DATA - they don't grant permissions
- Notes are encrypted for the owner - non-owners cannot even see the contents
- If multiple parties need to modify state (e.g., sender cancels, recipient withdraws), use PUBLIC storage instead

## Common Tasks

### Create a New Contract

When asked to create a contract, include:

1. Proper imports from aztec and dependencies
2. Storage struct with typed state variables
3. Constructor with `#[initializer]`
4. Core functions with appropriate visibility

### Add a Function

When adding functions:

1. Determine if it should be private or public
2. Add proper attributes
3. Handle authorization if needed
4. Update state correctly

### Implement Token Patterns

For token contracts, implement:

- Private balances using Owned<BalanceSet> (from balance_set library)
- Public balances using Map<Address, PublicMutable>
- Transfer, mint, burn functions
- Balance queries (constrained and unconstrained)

## Code Quality Guidelines

1. **Clear naming**: Use descriptive function and variable names
2. **Proper visibility**: Only make functions public when necessary
3. **Access control**: Add authorization checks on sensitive functions
4. **Error messages**: Include helpful assertion messages
5. **Documentation**: Add comments for complex logic

## ⚠️ Critical Anti-Patterns to Avoid

### Multi-Party Note Ownership (BROKEN)

```rust
// ❌ BROKEN: Sender cannot cancel - they don't own the note!
#[note]
struct StreamNote {
    sender: AztecAddress,     // Just data, NOT a permission
    recipient: AztecAddress,
    owner: AztecAddress,      // Only THIS address can nullify
}

// This will FAIL - sender cannot access recipient's note
fn cancel_stream(stream_id: Field, recipient: AztecAddress) {
    let sender = self.msg_sender().unwrap();
    // Sender cannot see or nullify the recipient's note!
    self.storage.streams.at(stream_id).at(recipient).replace(...); // FAILS
}
```

### Correct: Use Public Storage for Multi-Party State

```rust
// ✅ CORRECT: Public storage allows both parties to interact
#[storage]
struct Storage {
    streams: Map<Field, PublicMutable<StreamData, Context>, Context>,
}

fn cancel_stream(stream_id: Field) {
    let sender = self.msg_sender().unwrap();
    // Validate in public where both parties can access
    self.enqueue(Self::at(this).process_cancellation(stream_id, sender));
}
```

## Example Patterns

### Basic Token Transfer (Private)

```rust
#[external("private")]
fn transfer(to: AztecAddress, amount: u128) {
    let from = self.msg_sender().unwrap();
    self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
    self.storage.balances.at(to).add(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
}
```

### Admin-Only Function

```rust
#[external("public")]
fn set_config(new_value: Field) {
    assert(self.msg_sender().unwrap() == self.storage.admin.read(), "Unauthorized");
    self.storage.config.write(new_value);
}
```

### Public to Private Bridge

```rust
#[external("private")]
fn shield(amount: u128) {
    let sender = self.msg_sender().unwrap();
    self.enqueue_self._burn_public(sender, amount as u64);
    self.storage.private_balances.at(sender).add(amount).deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
}

#[external("public")]
#[only_self]
fn _burn_public(from: AztecAddress, amount: Field) {
    let balance = self.storage.public_balances.at(from).read();
    assert(balance >= amount, "Insufficient balance");
    self.storage.public_balances.at(from).write(balance - amount);
}
```
