# Test Fixtures

This directory contains test files for btget testing.

## 📁 Structure

```
test/fixtures/
├── README.md           # This file
├── torrents/          # Test torrent files (gitignored)
├── samples/           # Sample data files
└── configs/           # Test configuration files
```

## 🧪 Test Torrent Files

Test torrent files should be placed in the `torrents/` subdirectory. These files are automatically ignored by git to keep the repository clean.

### Adding Test Torrents

1. **Small Test Torrents**: Use small, legal torrents for testing
2. **Public Domain Content**: Only use torrents with public domain content
3. **Academic Torrents**: Consider using academic torrents for testing

### Recommended Test Files

- **Single File Torrents**: For testing single file downloads
- **Multi-File Torrents**: For testing directory structure creation
- **Large Piece Size**: For testing different piece configurations
- **Small File Size**: To keep tests fast (<10MB recommended)

## 🔒 Security Note

Never commit actual torrent files to the repository. The gitignore is configured to prevent this, but please be mindful when adding test files.

## 🚀 Usage in Tests

Test files can be referenced in tests like:

```typescript
import { join } from 'path';
import { FIXTURES_DIR } from '../setup';

const testTorrent = join(FIXTURES_DIR, 'torrents', 'test-file.torrent');
```

## 📋 Test Data Guidelines

1. **Legal Content Only**: Only use torrents with legal, redistributable content
2. **Small Size**: Keep test files small for fast test execution
3. **Variety**: Include different torrent types and configurations
4. **Documentation**: Document what each test file is for

## 🧹 Cleanup

The test framework automatically cleans up temporary files and download directories. Test fixture files themselves are preserved between test runs.