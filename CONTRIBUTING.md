# Contributing to Coffee & Cravings

Thank you for your interest in contributing to the Coffee & Cravings platform! Here is how to get started.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Coffee-cravings.git
   cd Coffee-cravings
   ```
3. Ensure you have Node.js 20 or higher installed.

## Running Tests

All changes must pass the automated test suites before being merged:

```bash
npm test
```

## Making Changes

1. Create a feature branch with a descriptive name (`git checkout -b feature/your-feature-name`).
2. Write clean, modular, and dependency-free JavaScript where possible (the project prioritizes native Node.js built-ins).
3. If modifying or adding API endpoints, add corresponding test coverage under `tests/`.
4. Ensure no hardcoded secrets, test credentials, or development bypasses are left in code.

## Submitting a Pull Request

- Provide a clear summary of what your change does and why it is needed.
- Reference any relevant open issues.
- Confirm all tests pass locally before submitting.
- Maintainers will review your pull request and provide feedback.
