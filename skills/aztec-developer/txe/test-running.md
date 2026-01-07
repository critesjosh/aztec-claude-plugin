# Pattern: Running TXE Tests

## When to use
When you need to compile and run TXE unit tests.

## Workflow

**Recompile** (only if contract code changed, not needed for test-only changes):
```bash
aztec compile
```

**Run tests**:
```bash
aztec test
```

**Useful flags**:
- `--package <name>` - compile/test only a specific package in a workspace
- `--exact <test_name>` - run only a specific test (useful for debugging)
