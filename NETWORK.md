# Network Versions

This plugin supports multiple Aztec network versions. Each network may have different syntax, APIs, and patterns.

## Available Networks

### mainnet
- **Status**: Stable production release
- **Aztec Version**: Latest stable
- **Use when**: Deploying to production, building for mainnet users

### testnet
- **Status**: Pre-release testing
- **Aztec Version**: Release candidate
- **Use when**: Testing before mainnet deployment, integration testing

### devnet
- **Status**: Active development
- **Aztec Version**: Latest development build
- **Use when**: Experimenting with new features, contributing to Aztec

## Switching Networks

```bash
# Switch to testnet
./setup.sh testnet

# Switch to devnet
./setup.sh devnet

# Check current network
./setup.sh status
```

## Version Differences

### Syntax Changes by Version

Each branch contains version-specific documentation in `CLAUDE.md` and the skills/commands directories. Key areas that may differ:

| Feature | mainnet | testnet | devnet |
|---------|---------|---------|--------|
| Note delivery | `.deliver()` | `.deliver()` | `.deliver(MessageDelivery.*)` |
| Storage patterns | `Map<>` | `Map<>` | `Owned<>` |
| Function attributes | `#[aztec(private)]` | `#[external("private")]` | `#[external("private")]` |

> **Note**: This table is illustrative. Check the branch-specific `CLAUDE.md` for accurate syntax.

## Branch Management

When updating the plugin for a new Aztec release:

1. Create/update the appropriate branch
2. Update `CLAUDE.md` with new syntax
3. Update skills and commands as needed
4. Test with the target network
5. Tag the release (e.g., `testnet-v0.87.0`)

## Compatibility

The plugin attempts to use syntax compatible with:
- **mainnet**: aztec-packages stable releases
- **testnet**: aztec-packages release candidates
- **devnet**: aztec-packages master branch

Always verify against the [official Aztec documentation](https://docs.aztec.network) for your target version.
