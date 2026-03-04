# Contract Development

Skills for writing Aztec smart contracts.

## Subskills

Start with the execution model, then dive into specific patterns:

### Execution Model & Composition
* [Transaction Lifecycle](./transaction-lifecycle.md) - Three-phase execution (Private→Kernel→Public), account entrypoint, AMM trace
* [Cross-Contract Calls](./cross-contract-calls.md) - self.call/enqueue/view, msg_sender propagation, runtime behavior
* [AuthWit](./authwit.md) - Authorizing another address to act on your behalf, end-to-end runtime flow

### Private State
* [Notes](./notes.md) - Note lifecycle, ownership, built-in types (UintNote, ValueNote), insert/get/remove
* [Partial Notes](./partial-notes.md) - Public→private transfers, runtime behavior, PXE reconstruction

### Contract Structure & Storage
* [Contract Structure](./contract-structure.md) - Basic template, macros, initializers, function annotations
* [Data Types](./data-types.md) - Primitives, addresses, strings, custom structs, BoundedVec
* [Storage](./storage.md) - Choosing state variable types (PublicMutable, Owned<PrivateSet>, Map, etc.)
* [DelayedPublicMutable](./delayed-public-mutable.md) - When private functions need to read mutable public state (e.g., authorization checks)
* [Compressed String](./compressed-string.md) - Storing string metadata (names, symbols) in contract storage
* [Public Structs](./public-structs.md) - Structured data in public storage using Packable trait
* [Events](./events.md) - Emitting public logs and private encrypted events
