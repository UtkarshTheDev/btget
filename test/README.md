# btget Tests

This directory contains the test suite for btget.

## 🧪 Test Structure

```
test/
├── setup.ts                 # Test environment setup
├── fixtures/                # Test data and fixtures
│   ├── torrents/            # Test torrent files (gitignored)
│   ├── samples/             # Sample data files
│   └── configs/             # Test configuration files
├── utils/                   # Unit tests for utility functions
│   ├── parser.test.ts       # Torrent parsing tests
│   ├── genId.test.ts        # ID generation tests
│   ├── pieces.test.ts       # Piece management tests
│   └── tracker.test.ts      # Tracker communication tests
├── cli/                     # CLI interface tests
│   ├── commands.test.ts     # Command parsing and execution
│   └── args.test.ts         # Argument validation tests
├── integration/             # Integration tests
│   ├── download.test.ts     # End-to-end download tests
│   └── workflow.test.ts     # Complete workflow tests
└── performance/             # Performance tests
    ├── startup.test.ts      # Startup time benchmarks
    └── memory.test.ts       # Memory usage tests
```

## 🚀 Running Tests

### All Tests
```bash
bun test
```

### Specific Test Files
```bash
bun test test/utils/parser.test.ts
bun test test/cli/commands.test.ts
```

### With Coverage
```bash
bun run test:coverage
```

### Watch Mode
```bash
bun run test:watch
```

## 📋 Test Categories

### 🔧 Unit Tests (`test/utils/`)
Test individual utility functions in isolation:

- **Parser Tests**: Torrent file parsing and validation
- **ID Generation**: Peer ID generation and uniqueness
- **Piece Management**: Piece tracking and validation
- **Tracker Communication**: Tracker protocol implementation

### 🖥️ CLI Tests (`test/cli/`)
Test command-line interface functionality:

- **Command Parsing**: Argument parsing and validation
- **Help System**: Help text and usage information
- **Error Handling**: CLI error messages and exit codes
- **Output Formatting**: Progress bars and status messages

### 🔄 Integration Tests (`test/integration/`)
Test complete workflows and system integration:

- **Download Workflow**: End-to-end download process
- **File Operations**: File creation and management
- **Network Operations**: Peer connections and data transfer
- **Error Recovery**: Handling network failures and interruptions

### ⚡ Performance Tests (`test/performance/`)
Test performance characteristics:

- **Startup Time**: Application startup benchmarks
- **Memory Usage**: Memory consumption during downloads
- **CPU Usage**: Processing efficiency
- **Bundle Size**: Built application size

## 🎯 Test Guidelines

### ✅ Best Practices

1. **Fast Execution**: Keep tests fast (<5 seconds per test)
2. **Isolation**: Each test should be independent
3. **Clean Setup**: Use setup/teardown for consistent state
4. **Clear Names**: Descriptive test and describe block names
5. **Edge Cases**: Test both happy path and error conditions

### 🧹 Cleanup

Tests automatically clean up after themselves:

- Temporary files are removed
- Test downloads are deleted
- Network connections are closed
- Process state is reset

### 🔒 Security

- No real torrent downloads in tests (use timeouts/mocks)
- No sensitive data in test files
- Test files are gitignored to prevent accidental commits

## 📊 Test Coverage

Target coverage goals:

- **Overall**: >80%
- **Critical Paths**: >90%
- **Utility Functions**: >95%
- **Error Handling**: >70%

## 🐛 Debugging Tests

### Verbose Output
```bash
bun test --verbose
```

### Single Test
```bash
bun test --test-name-pattern="should parse valid torrent"
```

### Debug Mode
```bash
DEBUG=1 bun test
```

## 🤝 Contributing Tests

When contributing new features:

1. **Add Tests**: Include tests for new functionality
2. **Update Existing**: Modify tests if behavior changes
3. **Document**: Add comments for complex test logic
4. **Performance**: Consider performance impact of tests

### Test Checklist

- [ ] Unit tests for new functions
- [ ] CLI tests for new commands/options
- [ ] Integration tests for new workflows
- [ ] Error handling tests
- [ ] Documentation updates

## 🔧 Test Configuration

Tests use the following configuration:

- **Framework**: Bun's built-in test runner
- **Setup**: Automatic test environment setup
- **Cleanup**: Automatic cleanup after each test
- **Timeout**: 10 seconds default timeout
- **Concurrency**: Parallel test execution where safe

## 📈 Test Metrics

Track test health with:

- **Pass Rate**: Percentage of passing tests
- **Execution Time**: Total test suite runtime
- **Coverage**: Code coverage percentage
- **Flakiness**: Tests that intermittently fail

---

Happy Testing! 🧪✨