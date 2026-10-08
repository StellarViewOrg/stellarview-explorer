# Dependency Management & Renovate Architecture

Documentation for automated dependency management, monorepo workspace maintenance, and Renovate bot workflows in `stellarview-explorer`.

## Overview

`stellarview-explorer` uses [Renovate](https://docs.renovatebot.com/) for automated dependency updates and lockfile maintenance across the Bun monorepo.

- **Automation Engine**: Renovate (`renovate[bot]`)
- **Package Manager**: Bun (`bun@1.4.2`) with workspace support (`apps/*`)
- **Interactive Tracking**: [Dependency Dashboard](https://github.com/StellarViewOrg/stellarview-explorer/issues/66) (Issue #66)
- **Primary Configuration**: `renovate.json` in repository root

## Configuration (`renovate.json`)

The repository configuration extends Renovate recommended presets:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended"
  ],
  "timezone": "UTC",
  "schedule": ["before 6am on monday"],
  "prConcurrentLimit": 5,
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "minor and patch dependencies"
    },
    {
      "matchDepTypes": ["devDependencies"],
      "groupName": "dev dependencies"
    }
  ],
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 6am on monday"]
  }
}
```

## Monitored Ecosystems & Workspace Architecture

Renovate monitors both monorepo root dependencies and the Next.js web application under `apps/explorer-web`:

### 1. Web Application (`apps/explorer-web/package.json`)

- **Core Framework & Runtime**: `next` (16.x), `react` (19.x), `react-dom`
- **Stellar Web3 SDKs**: `@stellar/stellar-sdk`, `@stellar/freighter-api`, `@creit-tech/sorobandomains-sdk`
- **UI & State**: Radix UI primitives (`@radix-ui/react-*`), Lucide Icons, `@tanstack/react-query`, Tailwind CSS v4, Motion
- **Tooling & DevDependencies**: ESLint 9, Prettier, Vitest 5, TypeScript 5.9, Husky, lint-staged

### 2. CI Workflows & GitHub Actions (`.github/workflows/`)

- Actions runners: `actions/checkout`, `actions/setup-node`, `oven-sh/setup-bun`

### Batching & Update Policies

1. **Scheduled Batching**: Updates run weekly before **6:00 AM UTC on Mondays** to keep developer velocity high during the working week.
2. **Concurrency Cap (`prConcurrentLimit: 5`)**: At most 5 dependency PRs are opened concurrently to avoid CI throttling.
3. **Grouped PRs**:
   - Minor and patch dependency bumps are consolidated into a single pull request (`minor and patch dependencies`).
   - Development tooling updates are grouped into a separate pull request (`dev dependencies`).
4. **Lockfile Maintenance**: Automated `bun.lock` re-synchronization runs weekly on Mondays.

## Dependency Dashboard (Issue #66) Operations

Renovate maintains Issue `#66` as a live interactive Dependency Dashboard.

> [!NOTE]
> Issue `#66` must remain open indefinitely. Closing this issue disables Renovate ability to present scheduled rebases, pending upgrades, and interactive retry controls.

### Dashboard Operations

- **Rate-Limited & Pending PRs**: Lists dependencies awaiting next Monday maintenance window.
- **On-Demand PR Creation**: Maintainers can check any update checkbox to immediately trigger a pull request ahead of the scheduled window.
- **Rebase & Retry Controls**: Checking the rebase box on open PRs instructs Renovate to rebase against `main`.

## Verification Commands

When testing dependency updates across the monorepo:

```bash
# Install dependencies with Bun
bun install

# Verify Next.js build
bun run build

# Run unit and integration tests
bun run test

# Check linting and formatting
bun run lint
bun run format:check:web
```
