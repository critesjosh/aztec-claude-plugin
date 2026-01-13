# Version Support

This plugin supports multiple Aztec versions within a single installation. No git branches or switching required.

## Available Versions

### devnet (Default)
- **Status**: Active development
- **Tag Pattern**: `aztec-packages-v*-devnet*` or `v0.87+`
- **Use when**: New development, experimenting with latest features
- **Syntax reference**: `versions/devnet/syntax.md`

### testnet
- **Status**: Pre-release testing
- **Tag Pattern**: `aztec-packages-v0.8[0-6]*`
- **Use when**: Integration testing, pre-production validation
- **Syntax reference**: `versions/testnet/syntax.md`

### mainnet
- **Status**: Future stable release
- **Tag Pattern**: `aztec-packages-v1.*`
- **Use when**: Production deployments (when available)
- **Syntax reference**: `versions/mainnet/syntax.md`

## Version Detection

The plugin auto-detects your project's version from `Nargo.toml`:

```toml
[dependencies]
aztec = { git = "...", tag = "aztec-packages-v0.87.4-devnet.0", directory = "..." }
```

### Manual Selection

```bash
./setup.sh devnet    # Use devnet syntax
./setup.sh testnet   # Use testnet syntax
./setup.sh mainnet   # Use mainnet syntax
./setup.sh status    # Show current version
./setup.sh detect    # Auto-detect from project
```

### Using /aztec:detect-version

Run the slash command to scan your project and report the detected version with syntax details.

## Syntax Differences by Version

| Feature | devnet | testnet | mainnet |
|---------|--------|---------|---------|
| Function attributes | `#[external("private")]` | `#[external("private")]` | TBD |
| Storage wrapping | `Owned<PrivateSet<>>` | `Owned<PrivateSet<>>` | TBD |
| Note delivery | `MessageDelivery::CONSTRAINED_ONCHAIN` | `MessageDelivery::CONSTRAINED_ONCHAIN` | TBD |

> **Note**: Mainnet syntax will be documented when mainnet launches. See `versions/<version>/syntax.md` for complete syntax references.

## Version Files

```
versions/
├── versions.json          # Version patterns and metadata
├── devnet/
│   └── syntax.md          # Complete devnet syntax reference
├── testnet/
│   └── syntax.md          # Complete testnet syntax reference
└── mainnet/
    └── syntax.md          # Mainnet syntax (placeholder)
```

## Configuration

The active version is stored in `.aztec-version`:

```json
{
  "version": "devnet",
  "setAt": "2025-01-13T00:00:00Z",
  "note": "Plugin configured for devnet syntax."
}
```

This file is created by `./setup.sh` and can be committed to your project to share version settings with your team.

## Compatibility Notes

- **Default behavior**: Uses devnet syntax if no version detected
- **Version mismatch**: Claude will warn if multiple Nargo.toml files have different versions
- **Unknown versions**: Falls back to devnet with a warning

Always verify against the [official Aztec documentation](https://docs.aztec.network) for your target version.
