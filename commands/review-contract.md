---
description: Review an Aztec contract for best practices and potential issues
---

# Review Aztec Contract

Review the Aztec contract at "$ARGUMENTS" for correctness, best practices, and potential issues.

## Review Checklist

Analyze the contract and provide feedback on:

### Structure
- Is the contract properly structured with correct attributes?
- Are imports complete and appropriate?
- Is the storage well-organized?

### Function Design
- Are functions using the correct visibility (private vs public)?
- Is access control implemented where needed?
- Are internal functions marked with `#[only_self]`?

### Privacy
- Could any private data leak through public functions?
- Are note operations handled correctly?
- Is msg_sender used safely in private functions?

### Security
- Are there proper authorization checks?
- Could there be state manipulation issues?
- Are inputs validated appropriately?

### Code Quality
- Is the code readable and well-organized?
- Are error messages helpful?
- Are there any obvious optimizations?

Provide specific recommendations with code examples where applicable.
