---
name: aztec-developer
description: "Aztec smart contract development, Noir programming, testing, deployment, and TypeScript integration. Use when working with Aztec contracts, notes, private state, or any Aztec SDK code. Use review-contract for security reviews."
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec Developer Skill

Framework knowledge for Aztec smart contract development that is NOT obvious from reading source code.

## Common Hallucinations to Avoid

These are facts Claude frequently gets wrong about Aztec. Consult this before making claims:

### Noir Integer Overflow
**Noir integer types (`u8`, `u64`, `u128`) PANIC on overflow — they do NOT wrap.** Only `Field` arithmetic wraps (around the field modulus). This means `u64` addition is already overflow-safe in Noir — no explicit guard is needed. However, `Field` should never be used for amounts that need overflow protection.

### The `#[note]` Macro Injects Randomness
The `#[note]` attribute macro **automatically injects a `NoteHeader` field** containing a nonce for commitment uniqueness. You do NOT need to add a manual randomness field to note structs. A note with only `amount` and `owner` fields is valid — the macro handles the rest.

### `Owned<PrivateSet<T>>` Requires Double `.at()`
For storage declared as `Map<AztecAddress, Owned<PrivateSet<NoteType>>>`:
```rust
self.storage.private_balances.at(owner_address).at(owner_address).insert(note)
```
The first `.at()` indexes the `Map` by key. The second `.at()` authenticates the `Owned` wrapper with the owner. **This is correct, not a bug.**

### `pop_notes` vs `get_notes`
- `get_notes()` reads notes **without nullifying them** — notes remain in the database after the call
- `pop_notes()` reads **and nullifies** in one step — the correct choice when consuming notes (e.g., spending a balance)
- If you use `get_notes()` to read notes you intend to consume, you must manually nullify them or they can be re-read

### `enqueue` vs `enqueue_incognito`
- `self.enqueue(...)` — the msg_sender of the enqueued public call is **visible on-chain**
- `self.enqueue_incognito(...)` — hides the msg_sender in the public call
- Use `enqueue_incognito` when the `shield` or private→public boundary should not reveal who initiated the action

### Token Amounts: Use `u128`, Not `u64`
`u64` max is ~18.4 × 10¹⁸. With 18 decimal places (standard), this limits total supply to ~18.4 tokens. **Always use `u128` for token amounts** to match ERC-20 semantics. The standard Aztec note type for balances is `UintNote` (from `uint_note` crate) which stores `value: u128`.

### `self.msg_sender()` vs `self.context.maybe_msg_sender()`
- `self.msg_sender()` — returns `AztecAddress` directly, **panics if sender is None**
- `self.context.maybe_msg_sender()` — returns `Option<AztecAddress>`, safe for entrypoints and incognito calls
- msg_sender is `None` at: (1) tx entrypoints (account contracts), (2) public calls via `enqueue_incognito()`
- **msg_sender in enqueued public calls is visible on-chain** — this is a common privacy leak

### Account Deployment Uses `AztecAddress.ZERO`
When deploying an account contract, the account doesn't exist on-chain yet, so it can't be the sender. Use `from: AztecAddress.ZERO` for the deployment transaction.

### Always Simulate Before Send
Call `.simulate()` before `.send()` for every state-changing transaction. Simulation runs locally and surfaces revert reasons immediately. Without it, a failing transaction hangs until the send timeout (up to 600s) with an opaque error.

## Subskills

* [Workspace Setup](./workspace/index.md) — Initializing and configuring Aztec projects
* [Contract Development](./contract-dev/index.md) — Writing Aztec smart contracts
* [Contract Unit Testing](./txe/index.md) — Unit testing with TXE

### Key Concepts

| Concept | What It Means in Aztec |
|---------|----------------------|
| **Notes** | Encrypted UTXOs — the only way to store private state. Only the owner can nullify. |
| **Nullifiers** | On-chain markers that "spend" a note without revealing which one. Prevents double-spend. |
| **Enqueue** | Private functions can't directly modify public state — they enqueue public calls for the sequencer. |
| **Owned\<T\>** | Wrapper that ties a private state variable to a specific owner. Required for private sets/maps. |

### Storage Types

| Need | Use |
|------|-----|
| Public value anyone can read/write | `PublicMutable<T>` |
| Private value only owner accesses | `Owned<PrivateMutable<T>>` |
| Private set of notes (e.g., balances) | `Owned<PrivateSet<T>>` |
| Per-user storage | `Map<AztecAddress, T>` |
| Public value readable from private (with delay) | `DelayedPublicMutable<T>` |

## Using Aztec MCP Server

For API docs and code examples beyond what's here, use:

```
aztec_sync_repos()                                           # sync first
aztec_search_code({ query: "<pattern>", filePattern: "*.nr" })
aztec_list_examples()
aztec_search_docs({ query: "<question>" })
```
