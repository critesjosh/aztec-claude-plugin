# Mainnet Syntax Reference

This document will contain the canonical syntax for Aztec mainnet (stable production version).

## Status

**Mainnet is not yet available.** This file is a placeholder for future stable syntax.

When mainnet launches, syntax may differ from devnet/testnet. Potential differences include:

## Expected Differences (Tentative)

These are potential syntax changes that may occur for mainnet stability. Verify against official docs when mainnet launches.

### Function Attributes

May revert to or add alternative syntax:
```rust
// Possible mainnet syntax (unconfirmed)
#[aztec(private)]
fn transfer(...) { }

// Or may remain the same as devnet
#[external("private")]
fn transfer(...) { }
```

### Storage Patterns

May simplify or modify `Owned<>` wrapper requirements.

### Note Delivery

May change `MessageDelivery` options or defaults.

## Dependencies (Nargo.toml)

```toml
[package]
name = "my_contract"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v1.0.0", directory = "noir-projects/aztec-nr/aztec" }
value_note = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v1.0.0", directory = "noir-projects/aztec-nr/value-note" }
```

## Migration Guide

When mainnet syntax is finalized, a migration guide will be provided here to help upgrade contracts from devnet/testnet.

## Current Recommendation

Until mainnet launches, use **devnet** syntax for new development and **testnet** for integration testing.
