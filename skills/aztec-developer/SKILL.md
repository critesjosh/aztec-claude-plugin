---
name: aztec-developer
description: "Patterns for Aztec development: contracts, frontend, testing. Use when working with Aztec contracts in any capacity unless otherwise specified"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Aztec Development Skills

Comprehensive patterns and best practices for Aztec smart contract development.

## Subskills

Navigate to the appropriate section based on your task:

* [Workspace Setup](./workspace/index.md) - Initializing and configuring Aztec projects
* [Contract Development](./contract-dev/index.md) - Writing Aztec smart contracts
* [Contract Unit Testing](./txe/index.md) - Unit testing Aztec smart contracts with TXE

## Quick Reference

### Creating a New Project
See [Project Setup](./workspace/project-setup.md) for initializing new Aztec projects.

### Writing Contracts
Start with [Contract Structure](./contract-dev/contract-structure.md) for the basic template, then explore:
- [Storage](./contract-dev/storage.md) - State variable types
- [Notes](./contract-dev/notes.md) - Private state management
- [Cross-Contract Calls](./contract-dev/cross-contract-calls.md) - Inter-contract communication

### Testing Contracts
See [TXE Setup](./txe/setup.md) to configure your test environment, then:
- [Writing Tests](./txe/writing-tests.md) - Test patterns and assertions
- [Running Tests](./txe/test-running.md) - Compilation and execution

## Using Context7 MCP

For detailed API documentation and code examples beyond what's covered here, use the Context7 MCP tool to query the Aztec documentation:

```
Library ID: /aztecprotocol/aztec-packages
```

This provides access to the latest Aztec.nr API, contract examples, and implementation details.
