# Testnet Syntax Reference

This document contains the canonical syntax for Aztec testnet (pre-release testing version).

## Status

Testnet syntax is currently aligned with devnet. As testnet stabilizes, any differences will be documented here.

## Function Attributes

Same as devnet:
- `#[external("private")]` for private functions
- `#[external("public")]` for public functions
- `#[external("utility")]` with `unconstrained` for view functions
- `#[initializer]` for constructors
- `#[internal]` for contract-internal functions
- `#[view]` for read-only functions

## Storage Patterns

Same as devnet:
- Private state requires `Owned<>` wrapper
- `Owned<PrivateSet<T, Context>, Context>` for collections
- `Owned<PrivateMutable<T, Context>, Context>` for single notes

## Note Delivery

Same as devnet:
- `MessageDelivery::CONSTRAINED_ONCHAIN`
- `MessageDelivery::UNCONSTRAINED_ONCHAIN`

## Dependencies (Nargo.toml)

```toml
[package]
name = "my_contract"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.85.0", directory = "noir-projects/aztec-nr/aztec" }
value_note = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "aztec-packages-v0.85.0", directory = "noir-projects/aztec-nr/value-note" }
```

Replace the tag with your target testnet version.

## Differences from Devnet

Currently none documented. Check release notes for your specific testnet version.
