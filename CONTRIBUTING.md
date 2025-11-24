# 🤝 Contributing to btget

First off, thank you for considering contributing to btget! It's people like you that make this project a great tool for the community.

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Development Setup](#-development-setup)
- [Pull Request Process](#-pull-request-process)
- [Style Guidelines](#-style-guidelines)
- [Testing Guidelines](#-testing-guidelines)
- [Issue Guidelines](#-issue-guidelines)
- [Recognition](#-recognition)

## 🤗 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Git
- TypeScript knowledge (helpful)
- Basic understanding of BitTorrent protocol (for core features)

### Development Environment

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/btget.git
cd btget

# Add upstream remote
git remote add upstream https://github.com/UtkarshTheDev/btget.git

# Install dependencies
bun install

# Build the project
bun run build

# Run tests to make sure everything works
bun test

# Start development
bun run dev
```

## 💡 How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/UtkarshTheDev/btget/issues) to avoid duplicates.

**When filing a bug report, please include:**

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected behavior**
- **Actual behavior**
- **Environment details** (OS, Node.js/Bun version, etc.)
- **Sample torrent file** (if applicable)
- **Command used** and **full output**

**Bug Report Template:**
```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Run command '...'
2. With torrent file '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g. macOS 14.0, Ubuntu 22.04, Windows 11]
- Runtime: [e.g. Bun 1.0.0, Node.js 18.17.0]
- CLI Version: [e.g. 1.2.3]

## Additional Context
Any other relevant information.
```

### ✨ Suggesting Enhancements

Enhancement suggestions are welcome! Please:

- **Check existing feature requests** first
- **Provide clear use case** and rationale
- **Consider implementation complexity**
- **Think about backwards compatibility**

### 🔧 Code Contributions

We love code contributions! Here are areas where help is especially welcome:

#### 🎯 High Priority Areas
- **Performance optimizations**
- **Bug fixes**
- **Test coverage improvements**
- **Documentation improvements**

#### 🛠️ Good First Issues
Look for issues labeled `good first issue` or `help wanted`:
- CLI output improvements
- Error message enhancements
- Code cleanup and refactoring
- Documentation updates

#### 🚀 Advanced Features
- Resume downloads functionality
- Seeding support
- Bandwidth limiting
- DHT support
- Magnet link support

## 🛠️ Development Setup

### Project Structure
```
src/
├── index.ts              # CLI entry point
├── types/                # Type definitions
└── utils/                # Core functionality
    ├── download.ts       # Download management
    ├── tracker.ts        # Tracker communication
    ├── parser.ts         # Torrent parsing
    ├── pieces.ts         # Piece management
    ├── queue.ts          # Download queue
    ├── messages.ts       # Protocol messages
    ├── genId.ts          # ID generation
    └── group.ts          # Data grouping
```

### Available Scripts

```bash
# Development
bun run dev              # Hot reload development
bun run build           # Production build
bun run rebuild         # Clean + build

# Testing
bun test                # Run all tests
bun run test:watch      # Watch mode
bun run test:coverage   # With coverage

# Quality
bun run lint            # Lint and check formatting with Biome
bun run format          # Format code with Biome
bun run typecheck       # TypeScript checking

# Utility
bun run clean           # Remove build files
```

### Setting Up for Development

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow our [style guidelines](#-style-guidelines)
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   # Run all checks
   bun run typecheck
   bun run lint
   bun test
   
   # Test CLI functionality
   bun run build
   ./dist/index.js info test.torrent
   ./dist/index.js download test.torrent -o /tmp/test
   ```

## 🔄 Pull Request Process

### Before Submitting

- [ ] **Branch** is up to date with main
- [ ] **Tests pass** locally
- [ ] **Linting passes** without errors
- [ ] **TypeScript compiles** without errors
- [ ] **Documentation updated** if needed
- [ ] **CHANGELOG.md updated** for user-facing changes

### PR Guidelines

1. **Clear title** describing the change
2. **Detailed description** explaining:
   - What changed and why
   - How to test the changes
   - Any breaking changes
   - Related issues

3. **Keep it focused** - one feature/fix per PR
4. **Include tests** for new functionality
5. **Update docs** if the change affects usage

### PR Template
```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

## 🎨 Style Guidelines

### TypeScript/JavaScript

- **Use TypeScript** for all new code
- **Follow existing patterns** in the codebase
- **Prefer explicit types** over `any`
- **Use meaningful variable names**
- **Add JSDoc comments** for public APIs

```typescript
// ✅ Good
interface TorrentInfo {
  name: string;
  size: bigint;
  pieceLength: number;
}

/**
 * Downloads a torrent file to the specified directory
 * @param torrent - Parsed torrent data
 * @param outputDir - Target directory for download
 */
async function downloadTorrent(torrent: Torrent, outputDir: string): Promise<void> {
  // Implementation
}

// ❌ Avoid
function download(t: any, o: any) {
  // Implementation
}
```

### Code Organization

- **Group related functionality** together
- **Use barrel exports** in `index.ts` files
- **Keep functions small** and focused
- **Extract constants** to meaningful names

### Error Handling

- **Use specific error types** when possible
- **Provide helpful error messages**
- **Log errors appropriately**

```typescript
// ✅ Good
try {
  const torrent = await parseTorrentFile(filePath);
} catch (error) {
  if (error instanceof TorrentParseError) {
    console.error(`Invalid torrent file: ${error.message}`);
  } else {
    console.error(`Failed to read torrent file: ${filePath}`);
  }
  process.exit(1);
}
```

## 🧪 Testing Guidelines

### Test Structure

- **Unit tests** for individual functions
- **Integration tests** for CLI commands
- **End-to-end tests** for complete workflows

### Writing Tests

```typescript
import { describe, it, expect } from 'bun:test';
import { parseTorrent } from '../src/utils/parser';

describe('Torrent Parser', () => {
  it('should parse valid torrent file', async () => {
    const result = await parseTorrent('./test/fixtures/valid.torrent');
    expect(result.info.name).toBe('test-file');
    expect(result.info['piece length']).toBe(262144);
  });

  it('should throw error for invalid torrent', async () => {
    expect(() => parseTorrent('./test/fixtures/invalid.torrent'))
      .toThrow('Invalid torrent file');
  });
});
```

### Test Coverage

- **Aim for 80%+ coverage** on new code
- **Test edge cases** and error conditions
- **Mock external dependencies** appropriately

## 📝 Issue Guidelines

### Creating Issues

- **Use descriptive titles**
- **Fill out issue templates** completely
- **Provide minimal reproduction cases**
- **Tag appropriately** (bug, enhancement, question, etc.)

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `performance` - Performance improvements
- `breaking` - Breaking changes

## 🏆 Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md** - All contributors listed
- **Release notes** - Major contributions highlighted
- **GitHub contributors** - Automatic recognition
- **Special mentions** - Outstanding contributions

### Levels of Recognition

- **🌟 Contributor**: Any merged PR
- **🚀 Core Contributor**: Multiple significant contributions
- **💎 Maintainer**: Ongoing maintenance and leadership

## 📞 Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Discord/Slack**: Real-time chat (if available)
- **Email**: Direct contact for sensitive issues

## 📚 Resources

### Learning Resources
- [BitTorrent Protocol Specification](http://www.bittorrent.org/beps/bep_0003.html)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Tools
- [Bun](https://bun.sh) - Runtime and bundler
- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [Biome](https://biomejs.dev/) - Linting and formatting

---

Thank you for contributing to btget! 🎉

Every contribution, no matter how small, makes a difference. We appreciate your time and effort in making this project better for everyone.

**Happy coding!** 🚀