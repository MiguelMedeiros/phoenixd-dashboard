# Contributing to Phoenixd Dashboard

First off, thanks for taking the time to contribute! ⚡

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs what actually happened
- **Screenshots** if applicable
- **Environment** (OS, browser, Docker version, etc.)

### Suggesting Features

Feature requests are welcome! Please open an issue with:

- **Clear title** describing the feature
- **Use case** — why would this be useful?
- **Possible implementation** (optional)

### Pull Requests

1. **Fork** the repository
2. **Create** your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make** your changes
4. **Test** your changes locally
5. **Commit** with a clear message
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push** to your branch
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open** a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/phoenixd-dashboard
cd phoenixd-dashboard

# Install dependencies
npm install

# Start development environment
docker compose up -d

# Frontend development
cd frontend && npm run dev

# Backend development
cd backend && npm run dev
```

## Code Style

- Use **TypeScript** for all new code
- Follow existing code patterns and conventions
- Run linting before committing: `npm run lint`
- Write meaningful commit messages

## Questions?

Feel free to open an issue for any questions or discussions.

---

Thank you for contributing! 🙏
