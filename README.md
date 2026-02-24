# Aztec Plugin for Claude Code

A Claude Code plugin for Aztec smart contract and application development. This plugin provides specialized agents, skills, and commands to help you build privacy-preserving applications on the Aztec Network.

⚠️ This plugin defaults to Aztec version `v4.0.0-devnet.2-patch.1`. See [Switching Versions](#switching-versions) to use a different version.

## Installation

### Option 1: Install from Marketplace (Recommended)

```
/plugin marketplace add critesjosh/aztec-claude-plugin
/plugin install aztec@aztec-plugins
```

### Option 2: Load from directory (Development)

Clone the repository and load directly:

```bash
git clone https://github.com/critesjosh/aztec-claude-plugin
claude --plugin-dir /path/to/aztec-plugin
```

## Updating

### Marketplace installs

```
/plugin marketplace update
```

### Local installs

```bash
cd /path/to/aztec-plugin
git pull
```

Changes take effect on the next Claude Code session.

## Network Versions

This plugin supports multiple Aztec network versions with potentially different syntax. Switch between them based on your target deployment:

```bash
# Clone with a specific network version
git clone https://github.com/critesjosh/aztec-claude-plugin
cd aztec-plugin
./setup.sh testnet  # or: mainnet, devnet
```

### Available Networks

| Network   | Description               | Use Case                        |
| --------- | ------------------------- | ------------------------------- |
| `mainnet` | Stable production release | Production deployments          |
| `testnet` | Pre-release testing       | Integration testing             |
| `devnet`  | Latest development        | Experimenting with new features |

### Switching Networks

```bash
# Switch to a different network
./setup.sh devnet

# Check current network
./setup.sh status
```

See [NETWORK.md](./NETWORK.md) for detailed version differences.

## Aztec MCP Server

This plugin includes the [aztec-mcp-server](https://www.npmjs.com/package/aztec-mcp-server) which provides local access to Aztec documentation, examples, and source code.

### Features

- **Repository Cloning** - Clones aztec-packages, aztec-examples, and aztec-starter locally
- **Code Search** - Regex-based search across Noir contracts and TypeScript files
- **Documentation Search** - Search Aztec docs by section
- **Example Discovery** - List and read example contracts

### Switching Versions

The plugin defaults to a specific Aztec version. To switch versions:

**Option 1: Use the `/aztec-version` command**

```
/aztec-version                    # Autodetect from project's Nargo.toml
/aztec-version v3.0.0-devnet.7    # Use specific version
```

The command will automatically detect the Aztec version from your project's `Nargo.toml` if no version is specified.

**Option 2: Call `aztec_sync_repos` directly**

```
aztec_sync_repos({ version: "v3.0.0-devnet.7", force: true })
```

**Check current version:**

```
aztec_status()
```

Find available versions at [aztec-packages tags](https://github.com/AztecProtocol/aztec-packages/tags).

## Features

### Slash Commands

| Command                             | Description                                  |
| ----------------------------------- | -------------------------------------------- |
| `/aztec:new-contract <name>`        | Create a new Aztec contract with boilerplate |
| `/aztec:review-contract <path>`     | Review a contract for best practices         |
| `/aztec:add-function <description>` | Add a new function to an existing contract   |
| `/aztec:add-test <description>`     | Add a test for a contract function           |
| `/aztec:explain <concept>`          | Explain an Aztec concept or pattern          |
| `/aztec:deploy <contract>`          | Generate a TypeScript deployment script      |
| `/aztec:generate-client <contract>` | Generate a TypeScript client class           |
| `/aztec-version <version>`          | Switch the Aztec version for MCP server      |

### Agents

**Contract Reviewer** (`contract-reviewer`)

- Reviews Aztec contracts for correctness and best practices
- Checks private/public function usage
- Identifies common issues and anti-patterns

**Security Auditor** (`security-auditor`)

- Performs security audits on Aztec contracts
- Identifies privacy vulnerabilities
- Detects ZK-specific security issues

### Skills

#### Noir Contract Development

**Aztec Developer** (`aztec-developer`) - _Comprehensive_

- Complete patterns for Aztec development
- Contract structure, storage, notes, cross-contract calls
- TXE unit testing with setup patterns
- Workspace configuration and compilation
- Based on [aztec-claude-skill](https://github.com/jp4g/aztec-claude-skill)

**Aztec Contract Development** (`aztec-contract-dev`)

- Assists with writing and modifying contracts
- Implements private/public functions
- Manages state and notes

**Aztec Testing** (`aztec-testing`)

- Helps write unit and integration tests
- Uses TestEnvironment patterns
- Debugs test failures

#### TypeScript Integration (NEW)

**Aztec Deploy** (`aztec-deploy`)

- Generate TypeScript deployment scripts
- Fee payment configuration (Sponsored, Private, Public)
- Environment configuration (local network, devnet)

**Aztec Accounts** (`aztec-accounts`)

- Schnorr account creation and deployment
- Account recovery from credentials
- Key management patterns

**Aztec TypeScript** (`aztec-typescript`)

- TypeScript client code generation
- Wallet setup and configuration
- Transaction patterns and error handling

**Aztec E2E Testing** (`aztec-e2e-testing`)

- Jest E2E test generation
- Sponsored fee testing patterns
- Multi-user test scenarios

#### Utilities

**Aztec Version** (`aztec-version`)

- Autodetects version from project's Nargo.toml
- Switch the Aztec version used by the MCP server
- Re-sync repositories to a different release tag

### Noir LSP Integration

The plugin includes LSP (Language Server Protocol) configuration for Noir, providing:

- Real-time diagnostics and error checking
- Code intelligence for `.nr` files
- Integration with the Nargo toolchain

**Requirement:** Nargo must be installed. The default path is `~/.nargo/bin/nargo`. Update `.lsp.json` if your installation is different.

## Usage Examples

### Create a new token contract

```
/aztec:new-contract MyToken
```

### Review an existing contract

```
/aztec:review-contract contracts/my_contract/src/main.nr
```

### Add a transfer function

```
/aztec:add-function Add a private transfer function that moves tokens between users
```

### Get help with a concept

```
/aztec:explain How do notes and nullifiers work in Aztec?
```

## What's Included

```
aztec-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── .lsp.json                # Noir LSP configuration
├── setup.sh                 # Network version switcher
├── network.json             # Current network config (git-ignored)
├── NETWORK.md               # Version differences documentation
├── agents/
│   ├── contract-reviewer.md # Contract review agent
│   └── security-auditor.md  # Security audit agent
├── commands/
│   ├── new-contract.md      # Create new contract
│   ├── review-contract.md   # Review contract
│   ├── add-function.md      # Add function
│   ├── add-test.md          # Add test
│   ├── explain.md           # Explain concept
│   ├── deploy.md            # Generate deployment script
│   └── generate-client.md   # Generate TypeScript client
├── skills/
│   ├── aztec-developer/     # Comprehensive dev patterns
│   │   ├── SKILL.md
│   │   ├── contract-dev/    # Contract patterns
│   │   ├── txe/             # Testing patterns
│   │   └── workspace/       # Project setup
│   ├── aztec-contract-dev/
│   │   └── SKILL.md
│   ├── aztec-testing/
│   │   └── SKILL.md
│   ├── aztec-deploy/        # TypeScript deployment (NEW)
│   │   ├── SKILL.md
│   │   ├── deploy-script.md
│   │   ├── fee-payment.md
│   │   └── environment-config.md
│   ├── aztec-accounts/      # Account management (NEW)
│   │   ├── SKILL.md
│   │   ├── schnorr-accounts.md
│   │   └── account-recovery.md
│   ├── aztec-typescript/    # TypeScript integration (NEW)
│   │   ├── SKILL.md
│   │   ├── contract-client.md
│   │   ├── wallet-setup.md
│   │   └── transaction-patterns.md
│   ├── aztec-e2e-testing/   # E2E testing (NEW)
│   │   ├── SKILL.md
│   │   ├── jest-setup.md
│   │   ├── test-patterns.md
│   │   └── sponsored-testing.md
│   └── aztec-version/       # Version switching (NEW)
│       └── SKILL.md
├── CLAUDE.md                # Development guidelines
└── README.md                # This file
```

## Development Guidelines

The `CLAUDE.md` file contains comprehensive guidelines for Aztec development including:

- Contract structure and boilerplate
- Private vs public function patterns
- State management with notes
- Testing patterns
- Security best practices

## Resources

- [Aztec Documentation](https://docs.aztec.network)
- [Noir Language](https://noir-lang.org)
- [Aztec GitHub](https://github.com/AztecProtocol/aztec-packages)

## License

MIT
