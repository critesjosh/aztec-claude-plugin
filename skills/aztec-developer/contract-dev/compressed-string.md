# Pattern: Compressed String Storage

## When to use
Storing string metadata in contract storage.

## How it works
Field elements have 32 bytes but only 31 are usable for data. Compressed strings pack string bytes into fields:
- `FieldCompressedString`: up to 31 bytes in 1 field
- `CompressedString<N, M>`: M bytes across N fields (N = ceil(M / 31))

Use the Aztec MCP server if you require more context than this.

## Import
```toml
...
compressed_string = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "{version}", directory = "noir-projects/aztec-nr/compressed-string" }
```

```rust
use compressed_string::FieldCompressedString;
```

## Use
```rust
let some_string: str<31> = "...";
let compressed = FieldCompressedString::from_string(some_string);
```

## JS
`readFieldCompressedString` exists for parsing a string from a single field compressed string. Manual utilities must be built for CompressedString containing > 1 field.
