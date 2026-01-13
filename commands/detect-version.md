---
description: Detect and display the Aztec version for the current project
---

# Detect Aztec Version

Scan the current project to determine which Aztec version is being used and report the appropriate syntax variant.

## Instructions

1. **Search for Nargo.toml files** in the project:
   - Check project root
   - Check `contracts/` directory
   - Check any subdirectories with `Nargo.toml`

2. **Extract the version tag** from the `aztec` dependency:
   ```toml
   aztec = { git = "...", tag = "aztec-packages-vX.Y.Z", directory = "..." }
   ```

3. **Match against version patterns**:
   - `aztec-packages-v*-devnet*` or `v0.87+` → **devnet**
   - `aztec-packages-v0.8[0-6]*` → **testnet**
   - `aztec-packages-v1.*` → **mainnet**

4. **Report findings**:
   - Detected version (devnet/testnet/mainnet)
   - Tag found in Nargo.toml
   - Syntax reference file path
   - Any version mismatches between multiple Nargo.toml files

## Output Format

```
Aztec Version Detection
=======================

Nargo.toml files found:
- contracts/token/Nargo.toml
  Tag: aztec-packages-v0.87.4-devnet.0

Detected version: devnet
Syntax reference: versions/devnet/syntax.md

Key syntax for this version:
- Function attributes: #[external("private")]
- Storage: Owned<PrivateSet<T, Context>, Context>
- Note delivery: .deliver(MessageDelivery::CONSTRAINED_ONCHAIN)
```

## Version Mismatch Warning

If multiple Nargo.toml files have different version tags, warn the user:

```
WARNING: Version mismatch detected!
- contracts/token/Nargo.toml: aztec-packages-v0.87.4-devnet.0
- contracts/bridge/Nargo.toml: aztec-packages-v0.85.0

Recommendation: Align all dependencies to the same version.
```

## No Version Found

If no Nargo.toml or no aztec dependency:

```
No Aztec version detected.
Using default: devnet

To set a specific version:
- Run ./setup.sh <version>
- Or create .aztec-version file
```
