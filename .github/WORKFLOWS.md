# GitHub Actions Workflows Summary

## 📁 Workflow Files

### 1. CI Workflow (`.github/workflows/ci.yml`)
**Triggers:** Push to `main`/`develop`, Pull Requests to `main`

**Jobs:**
- **Test**: Runs on Ubuntu, Windows, macOS with Node 20.x
  - Type checking
  - Linting
  - Build verification
  - CLI functionality tests
  
- **Build**: Creates production build and analyzes package size
  - Uploads build artifacts (v4 format)
  
- **Security**: Runs npm security audit

### 2. Release Workflow (`.github/workflows/release.yml`)
**Triggers:** Push tags matching `v*.*.*` (e.g., v1.0.0)

**Jobs:**
- **Build**: Full build with type checking and linting
- **Create Release**: 
  - Extracts changelog for version
  - Creates GitHub release with tarball
  - Auto-generates release notes
- **Publish to npm**: Publishes package to npm registry
- **Publish to GitHub Packages**: Publishes to GitHub Packages registry

### 3. Badges Workflow (`.github/workflows/badges.yml`)
**Triggers:** Push to `main`, Daily at 00:00 UTC, Manual dispatch

**Purpose:** Tracks npm package statistics for badge updates

## 🎯 Quick Start

### To Create a Release:

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Commit changes
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.0.1"
git push origin main

# 4. Create and push tag
git tag v1.0.1
git push origin v1.0.1
```

### Required Secrets:
- `NPM_TOKEN` - Get from npmjs.com (Settings → Access Tokens)
- `GITHUB_TOKEN` - Auto-provided by GitHub

## 📊 Badges in README

All badges are automatically updated:
- npm version & downloads
- GitHub release version & date
- CI/Release workflow status
- License, Node.js version
- Stars, issues, PRs
- Package size

## 📚 Documentation

See `.github/RELEASE.md` for detailed release instructions and troubleshooting.
