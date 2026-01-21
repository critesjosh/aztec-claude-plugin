# Contract Development

Skills for writing Aztec smart contracts.

## Subskills
Traverse according to needed functionality:
* [Contract Structure](./contract-structure.md) - Basic template, macros, initializers, function annotations
* [Data Types](./data-types.md) - Primitives, addresses, strings, custom structs, BoundedVec
* [Storage](./storage.md) - Choosing state variable types (PublicMutable, Owned<PrivateSet>, Map, etc.)
* [Cross-Contract Calls](./cross-contract-calls.md) - Calling functions on other contracts or your own, private→public execution flow
* [DelayedPublicMutable](./delayed-public-mutable.md) - When private functions need to read mutable public state (e.g., authorization checks)
* [AuthWit](./authwit.md) - Authorizing another address to act on your behalf (like approvals, but for specific actions)
* [Compressed String](./compressed-string.md) - Storing string metadata (names, symbols) in contract storage
* [Partial Notes](./partial-notes.md) - Public→private transfers where public determines the amount but recipient stays hidden
* [Notes](./notes.md) - Private state: defining notes, built-in types (UintNote, ValueNote), insert/get/remove
* [Public Structs](./public-structs.md) - Structured data in public storage using Packable trait
* [Events](./events.md) - Emitting public logs and private encrypted events
