# Contributing to NyxTrace

Thank you for considering contributing to NyxTrace! This document outlines the
process and conventions.

## Code of Conduct

Be respectful, constructive, and professional. Harassment or personal attacks
will not be tolerated.

## How to contribute

### 1. Reporting bugs

Open a [GitHub Issue](https://github.com/anomalyco/NyxTrace/issues/new?template=bug_report.md)
with the "Bug Report" template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, browser)
- Screenshots or logs if applicable

### 2. Suggesting features

Open a [Feature Request](https://github.com/anomalyco/NyxTrace/issues/new?template=feature_request.md)
issue. Explain the use case and how the feature improves the platform.

### 3. Pull requests

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run validations:

   ```bash
   npm run build:check --prefix backend
   npm run build:check --prefix frontend
   npm test --prefix backend
   ```

5. Commit using conventional commits (see below)
6. Push and open a Pull Request

### Commit message format

We use [conventional commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

BREAKING CHANGE: <breaking change description>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `security`

**Scopes:** `backend`, `frontend`, `blockchain`, `ai`, `sandbox`, `docs`, `ci`

Examples:

```
fix(backend): prevent evidence search NoSQL injection
feat(frontend): add evidence upload progress bar
security(backend): rotate exposed secrets
```

## Project structure

```
NyxTrace/
├── backend/          # Express.js API + blockchain services
├── frontend/         # React + Vite SPA
├── ai-service/       # Python AI microservice
├── sandbox-agent-v2/ # Python sandbox orchestration agent
├── blockchain/       # Solidity smart contracts + Hardhat
└── shared/           # Cross-service configs and schemas
```

## Development setup

See the [README](README.md#-quick-start) for setup instructions.
