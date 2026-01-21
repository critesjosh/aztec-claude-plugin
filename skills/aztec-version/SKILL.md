---
name: aztec-version
description: Switch the Aztec version used by the MCP server. Autodetects version from Nargo.toml if no version specified. Use when starting work on an Aztec project or switching versions.
allowed-tools: Read, Grep, Glob, Bash
---

# Aztec Version Skill

Switch the Aztec version used by the local MCP server repositories. Autodetects version from the user's project if not specified.

## Usage

```
/aztec-version [version-tag]
```

**Examples:**

```
/aztec-version                           # Autodetect from Nargo.toml
/aztec-version v3.0.0-devnet.6-patch.1   # Use specific version
```

## Workflow

### Step 1: Determine Version

**If version argument provided:**
- Use the provided version directly

**If no version argument (autodetect):**

1. Search for Nargo.toml files in the project:

```bash
Glob: **/Nargo.toml
```

2. Read the Nargo.toml and extract the aztec dependency tag:

```toml
# Look for this pattern:
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
```

3. Extract the `tag` value using grep:

```bash
grep -oP 'aztec.*tag\s*=\s*"\K[^"]+' Nargo.toml
```

4. If multiple Nargo.toml files exist, use the first one found (usually the root contract)

5. If no Nargo.toml found or no aztec dependency:
   - Inform the user no version could be detected
   - Ask them to specify a version explicitly

### Step 2: Confirm with User

Before syncing, show the detected/provided version:

```
Detected Aztec version: v3.0.0-devnet.6-patch.1
Sync MCP server repositories to this version?
```

### Step 3: Sync Repositories

Call `aztec_sync_repos` with the version:

```
aztec_sync_repos({ version: "<detected-or-provided-version>", force: true })
```

### Step 4: Verify and Report

1. Call `aztec_status()` to verify the sync

2. Report to the user:
   - Which version was synced
   - Which repositories were updated
   - Any errors that occurred

## Autodetection Details

The autodetection looks for the `aztec` dependency in Nargo.toml files:

```toml
[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
```

It can also detect from `aztec-packages` references:

```toml
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v3.0.0-devnet.6", directory = "noir-projects/aztec-nr/aztec" }
```

## Available Versions

Users can find available Aztec versions at:
https://github.com/AztecProtocol/aztec-packages/tags

Common version patterns:
- `v3.0.0-devnet.X` - Devnet releases
- `v3.0.0-devnet.X-patch.Y` - Patched devnet releases

## Error Handling

**No Nargo.toml found:**
- "No Nargo.toml found in this project. Please specify a version: `/aztec-version v3.0.0-devnet.6`"

**No aztec dependency in Nargo.toml:**
- "No aztec dependency found in Nargo.toml. Please specify a version: `/aztec-version v3.0.0-devnet.6`"

**Version tag not found on GitHub:**
- The `aztec_sync_repos` tool will fail with a git error
- Inform the user the version tag was not found
- Suggest they check the available tags on GitHub
