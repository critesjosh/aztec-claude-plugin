---
description: Switch the Aztec version used by the MCP server. Autodetects version from Nargo.toml if no version specified.
---

# Aztec Version

Switch the Aztec version used by the local MCP server repositories.

**Version argument:** $ARGUMENTS

## Workflow

### Step 1: Determine Version

**If version argument provided:**
- Use the provided version directly

**If no version argument (autodetect):**

1. Search for Nargo.toml files in the project using Glob: `**/Nargo.toml`

2. Read the Nargo.toml and extract the aztec dependency tag:
```toml
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v3.0.0-devnet.6-patch.1", directory = "aztec" }
```

3. If no Nargo.toml found or no aztec dependency, ask the user to specify a version explicitly.

### Step 2: Confirm with User

Before syncing, show the detected/provided version and ask for confirmation.

### Step 3: Sync Repositories

Call `aztec_sync_repos` with the version:
```
aztec_sync_repos({ version: "<detected-or-provided-version>", force: true })
```

### Step 4: Verify and Report

1. Call `aztec_status()` to verify the sync
2. Report which version was synced and any errors
