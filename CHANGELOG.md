# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-29

### Added

#### Core BitTorrent Features
- **Full BitTorrent Protocol Implementation**: Complete support for downloading `.torrent` files with proper piece verification using SHA-1 hashing
- **Multi-Tracker Support**: Connects to multiple trackers simultaneously for reliable peer discovery
- **DHT Support (BEP 0005)**: Distributed Hash Table implementation for tracker-less peer discovery with `--dht-only` flag
- **Multi-File Torrents**: Seamless handling of torrents with multiple files and complex directory structures
- **Resume Downloads**: Automatic detection and resumption of interrupted downloads
- **Path Traversal Protection**: Security measures to prevent Zip Slip vulnerabilities

#### Peer Management & Performance
- **Smart Peer Management**: Intelligent connection pooling with configurable limits
- **Choking Algorithm**: Tit-for-tat implementation for fair piece exchange and upload optimization
- **Request Pipelining**: Multiple simultaneous piece requests per peer for maximum throughput
- **LRU RAM Cache**: In-memory caching of recently downloaded pieces to reduce disk I/O
- **Active Seeding**: Upload support for completed pieces during download
- **Swarm Poisoning Protection**: Data integrity verification before broadcasting to peers
- **Progress-Based Timeout Strategy**: Adaptive timeout handling for large file downloads

#### User Interface & Experience
- **Modern TUI (Terminal UI)**: Beautiful Ink-based interface with real-time updates
- **Real-Time Statistics**: Live display of download/upload speeds, peer count, seeders, and leechers
- **Dual Speed Sparklines**: Visual graphs for both download and upload speed history
- **Smart ETA Calculation**: Exponential Moving Average (EMA) algorithm for accurate time estimates
- **Dynamic Status Messages**: Context-aware status updates (Finding Peers, Downloading, Completed)
- **Upload/Download Ratio**: Real-time tracking of share ratio
- **Auto-Exit**: Automatic CLI exit after successful download completion
- **Debug Mode**: Optional `--debug` flag to show console logs instead of TUI

#### CLI & Commands
- **Dual Usage Modes**: Direct download (`btget file.torrent`) or command-based (`btget download file.torrent`)
- **Info Command**: Inspect torrent metadata without downloading (`btget info file.torrent`)
- **Flexible Output**: Custom output directory with `-o/--output` flag
- **Help System**: Comprehensive help with examples and usage instructions

#### Developer Experience
- **TypeScript**: Fully typed codebase for better maintainability
- **Bun Build**: Optimized bundling with tree-shaking and minification
- **Biome Linting**: Code quality enforcement with zero linting errors
- **Modular Architecture**: Clean separation of concerns (core, DHT, peers, pieces, protocol, tracker, UI, utils)
- **Cross-Platform**: Works on Windows, macOS, and Linux

#### Performance Optimizations
- **Asynchronous I/O**: Non-blocking file operations for better performance
- **Piece Verification**: Efficient SHA-1 hash verification for data integrity
- **Connection Stability**: Improved timeout handling and peer reconnection logic
- **Disk Thrashing Prevention**: Smart caching to minimize disk writes

### Fixed
- Zero upload speed issues through proper choking algorithm implementation
- ETA calculation accuracy using Exponential Moving Average
- UI display issues with speed colors and sparkline visibility
- Large file download timeouts with progress-based timeout strategy
- Console output suppression during TUI execution
- TypeScript compilation errors across the entire codebase
- Linting errors for magic numbers, unused variables, and non-null assertions

### Security
- **Zip Slip Protection**: Path traversal prevention in FileWriter
- **Data Integrity**: End-to-end SHA-1 verification before piece broadcasting
- **Swarm Poisoning Prevention**: Verification of all incoming pieces before sharing

### Documentation
- Comprehensive README with installation, usage, and development guides
- Contributing guidelines for community participation
- Detailed project structure documentation
- Example commands and use cases

### Distribution
- Published to npm as `btget` package
- Global installation support via `npm install -g btget`
- Single executable bundle with zero runtime dependencies
- Optimized package size with selective file inclusion

---

**Full Changelog**: https://github.com/UtkarshTheDev/btget/commits/v1.0.0