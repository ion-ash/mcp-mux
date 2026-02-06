# Git Hooks

This project uses Git hooks to maintain code quality and prevent CI failures.

## Pre-commit Hook

The pre-commit hook automatically runs before each commit to validate:

### ✅ **Rust Validation**
- Formats Rust code with `cargo fmt`
- Runs `cargo clippy --workspace -- -D warnings` to catch linting issues
- Runs `cargo check --workspace` to verify compilation
- Automatically adds formatted files to the commit

### ✅ **TypeScript Validation**
- Runs `pnpm typecheck` to verify type correctness
- Checks all TypeScript files in the workspace

## Setup

The hook is automatically set up when you:
1. Clone the repository
2. Run `pnpm install` (triggers `prepare` script)

### Manual Setup

If the hook isn't working, run:

```bash
# Make hook executable (Linux/Mac)
chmod +x .git/hooks/pre-commit

# Windows (PowerShell)
icacls ".git\hooks\pre-commit" /grant Everyone:RX
```

## Testing the Hook

To test the validation without committing:

```bash
# Run both checks
pnpm validate

# Or individually
cargo clippy --workspace -- -D warnings
cargo check --workspace
pnpm typecheck
```

## Bypassing the Hook (Not Recommended)

In rare cases where you need to bypass validation:

```bash
git commit --no-verify -m "your message"
```

**Note**: Only use `--no-verify` when absolutely necessary, as it skips important validations that prevent CI failures.

## Troubleshooting

### Hook not running
- Ensure `.git/hooks/pre-commit` exists
- Check it's executable: `ls -la .git/hooks/pre-commit`
- Try manual setup commands above

### Hook fails on Windows
- The hook uses bash scripting (requires Git Bash or WSL)
- Alternatively, use the PowerShell version: `.git/hooks/pre-commit.ps1`
- Configure Git to use PowerShell hooks:
  ```powershell
  git config core.hooksPath .git/hooks
  ```

### Slow validation
- The hook only validates files in your commit (staged changes)
- If you have many Rust crates, consider using `cargo check -p <crate-name>`
- TypeScript check runs on entire workspace (necessary for type consistency)

## CI Integration

These same checks run in CI:
- GitHub Actions runs `cargo check` and `pnpm typecheck`
- Pre-commit hooks help catch issues early before pushing
