# GitHub Copilot Configuration

This repository is configured to work optimally with GitHub Copilot coding agent, following [GitHub's best practices](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results).

## What's Configured

### 1. Custom Instructions (`.github/copilot-instructions.md`)

The repository includes comprehensive custom instructions that provide Copilot with:

- **Project Context**: Tech stack (TypeScript, Node.js, Express, PostgreSQL, TON SDK)
- **Architecture Overview**: Monorepo structure with 5 packages
- **Code Patterns**: Service layer conventions, controller patterns, model usage
- **Critical Flows**: Payment processing, deposit monitoring, P2P liquidity routing
- **Common Tasks**: Adding endpoints, database migrations, debugging
- **Development Timeline**: 16-week phased rollout with priorities

These instructions help Copilot understand the codebase structure and make context-aware suggestions.

### 2. Setup Steps (`.github/workflows/copilot-setup-steps.yml`)

Pre-installs dependencies before Copilot starts working on tasks:

- ✅ Node.js 20 with npm cache
- ✅ All workspace dependencies via `npm ci`
- ✅ PostgreSQL 16 service for database operations
- ✅ TypeScript compilation for all packages
- ✅ Database migrations
- ✅ Environment variable setup

**Benefits:**
- Faster task execution (no trial-and-error dependency installation)
- More reliable builds and tests
- Consistent development environment

### 3. Best Practices Applied

✅ **Well-Scoped Issues**: Instructions guide Copilot to make minimal, surgical changes  
✅ **Clear Documentation**: Comprehensive architecture and code pattern documentation  
✅ **Testing Guidance**: Instructions specify when and how to run tests  
✅ **Incremental Progress**: Encourages using `report_progress` for commits  
✅ **Security Focus**: Instructions include security validation requirements  

## Using GitHub Copilot with This Repository

### For Contributors

When working with Copilot coding agent on this repository:

1. **Create Clear Issues**: Provide clear problem descriptions and acceptance criteria
2. **Reference Instructions**: The agent will automatically use `.github/copilot-instructions.md`
3. **Iterative Review**: Review PRs created by Copilot and provide feedback with `@copilot` mentions
4. **Task Scope**: Best suited for:
   - Bug fixes
   - Adding new endpoints
   - Improving test coverage
   - Documentation updates
   - Refactoring individual components

### Task Examples

**Good tasks for Copilot:**
- "Add a new API endpoint to retrieve payment history for a user"
- "Fix the rate locking logic in ConversionService to handle expired locks"
- "Add unit tests for WalletManagerService deposit confirmation"
- "Update API documentation to include the new webhook payload format"

**Tasks that need human oversight:**
- Complex business logic changes
- Security-sensitive authentication/authorization
- Major architectural refactoring
- Production incident response

### Development Workflow

1. **Assign Issue**: Assign an issue to Copilot or prompt it with a task
2. **Automatic Setup**: The setup workflow prepares the environment
3. **Code Changes**: Copilot makes changes following the instructions
4. **Validation**: Copilot runs lints, builds, and tests
5. **PR Creation**: Copilot creates a PR with changes
6. **Review & Iterate**: Review the PR and provide feedback

## Customizing Copilot Behavior

### Updating Instructions

To modify Copilot's behavior, edit `.github/copilot-instructions.md`:

```bash
# Edit instructions
vim .github/copilot-instructions.md

# Commit changes
git add .github/copilot-instructions.md
git commit -m "docs: update Copilot instructions for X"
git push
```

Changes take effect immediately for new Copilot sessions.

### Modifying Setup Steps

To change pre-installed dependencies, edit `.github/workflows/copilot-setup-steps.yml`:

```yaml
- name: Install custom tool
  run: npm install -g some-tool
```

**Important:** The workflow must be on the default branch to take effect.

### Creating Custom Agents (Optional)

For specialized workflows, you can create custom agent profiles in `.github/agents/`:

```markdown
# .github/agents/test-specialist.md
You are a testing specialist for this repository...
```

See [Creating custom agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents) for details.

## Environment Variables

The setup workflow uses these PostgreSQL credentials for testing:

```
POSTGRES_USER=tg_user
POSTGRES_PASSWORD=tg_pass
POSTGRES_DB=tg_payment_dev
DATABASE_URL=postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev
```

These match the values in `.env.example` for consistency.

## Validation

To validate your Copilot setup configuration, run:

```bash
bash scripts/validate-copilot-setup.sh
```

This script checks:
- ✅ Workflow file exists and has correct job name
- ✅ Required setup steps are present
- ✅ Instructions file exists and is under 1000 lines
- ✅ YAML syntax is valid
- ✅ Documentation exists

## Troubleshooting

### Copilot can't build the project

1. Check that `.github/workflows/copilot-setup-steps.yml` is on the default branch
2. Verify the workflow runs successfully: Go to Actions tab → Copilot Setup Steps
3. Update the workflow to include missing dependencies
4. Run `bash scripts/validate-copilot-setup.sh` to check configuration

### Copilot isn't following instructions

1. Ensure `.github/copilot-instructions.md` is concise (under 1000 lines)
2. Use clear, imperative language
3. Add specific examples for clarity
4. Break long documents into sections with headers

### Setup workflow fails

1. Check workflow logs in the Actions tab
2. Verify all commands work locally
3. Ensure `package.json` scripts are defined correctly
4. Check PostgreSQL service configuration

## Resources

- [GitHub Copilot Coding Agent Documentation](https://docs.github.com/en/copilot/tutorials/coding-agent)
- [Best Practices Guide](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results)
- [Customizing Development Environment](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)
- [Creating Custom Agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)

## Contributing

When contributing to this repository with Copilot:

1. Follow the patterns documented in `.github/copilot-instructions.md`
2. Make minimal, surgical changes
3. Run tests locally before pushing
4. Use `report_progress` to commit incrementally
5. Request code reviews before finalizing

---

**Note**: This Copilot configuration is optimized for solo developer productivity with AI assistance. The setup reduces manual configuration and accelerates development velocity while maintaining code quality.
