# 🚀 btget - BitTorrent Get CLI

<div align="center">

![BitTorrent CLI](https://img.shields.io/badge/BitTorrent-CLI-blue?style=for-the-badge&logo=bittorrent)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)

**A modern, fast, and lightweight BitTorrent client for the command line.**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Development](#-development) • [Contributing](#-contributing)

<!-- Package & Release Badges -->
[![npm version](https://img.shields.io/npm/v/btget.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/btget)
[![npm downloads](https://img.shields.io/npm/dm/btget.svg?style=flat-square)](https://npmjs.org/package/btget)
[![GitHub release](https://img.shields.io/github/v/release/UtkarshTheDev/btget?style=flat-square&logo=github)](https://github.com/UtkarshTheDev/btget/releases)
[![GitHub Release Date](https://img.shields.io/github/release-date/UtkarshTheDev/btget?style=flat-square)](https://github.com/UtkarshTheDev/btget/releases)

<!-- Build & Quality Badges -->
[![CI](https://img.shields.io/github/actions/workflow/status/UtkarshTheDev/btget/ci.yml?branch=main&style=flat-square&logo=github-actions&label=CI)](https://github.com/UtkarshTheDev/btget/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/UtkarshTheDev/btget/release.yml?style=flat-square&logo=github-actions&label=Release)](https://github.com/UtkarshTheDev/btget/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/btget?style=flat-square&logo=node.js)](https://nodejs.org)

<!-- Repository Stats -->
[![GitHub stars](https://img.shields.io/github/stars/UtkarshTheDev/btget?style=flat-square&logo=github)](https://github.com/UtkarshTheDev/btget/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/UtkarshTheDev/btget?style=flat-square&logo=github)](https://github.com/UtkarshTheDev/btget/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/UtkarshTheDev/btget?style=flat-square&logo=github)](https://github.com/UtkarshTheDev/btget/pulls)
[![Package Size](https://img.shields.io/bundlephobia/min/btget?style=flat-square)](https://bundlephobia.com/package/btget)

</div>

---

`btget` is a command-line BitTorrent client designed for speed and ease of use. It allows you to download files from `.torrent` files directly, with real-time progress and a focus on efficiency. The interface is designed to be intuitive, allowing you to use it directly like `wget` or with explicit commands like `download` and `info`.

## 🌟 Features

- ⚡ **High Performance**: Built on Bun for a fast startup and optimized runtime performance.
- 🌐 **DHT Support**: Tracker-less peer discovery using the Distributed Hash Table (BEP 0005).
- 🧠 **Smart Peer Management**: Intelligent connection pooling and download speed tracking.
- 🛡️ **Resilient Downloads**: End-to-end data integrity verification with SHA-1 hashing.
- 📊 **Real-Time Progress**: A clean interface showing download speed, peer count, and progress bars.
- 🎯 **Multi-Tracker Support**: Connects to multiple trackers to ensure reliable peer discovery.
- 📁 **Multi-File Torrents**: Seamlessly handles torrents containing multiple files and complex directory structures.
- 🔍 **Torrent Inspector**: Allows viewing detailed information about a `.torrent` file without starting the download.
- 📦 **Cross-Platform**: A single executable that runs on Windows, macOS, and Linux.

## ✅ Prerequisites

- **Node.js**: Required for using `npm` or `npx`.
- **Bun**: Required for development and building from source.

## 🚀 Quick Start

For most users, global installation via `npm` is the simplest method.

```bash
npm install -g btget
```

### Usage

```bash
# Download a torrent to a specified output directory
btget my-file.torrent -o ./downloads

# View details about a torrent file
btget info ubuntu.torrent

# Get help on commands
btget --help
```

## 📦 Installation

### Option 1: Global Installation (Recommended)

This makes the `btget` command available system-wide.

```bash
npm install -g btget
```

### Option 2: Local Installation

This installs `btget` in your current project for programmatic use or testing.

```bash
npm install btget
npx btget my-file.torrent
```

### Option 3: From Source

Build the project directly for development or contributing.

```bash
git clone https://github.com/UtkarshTheDev/btget.git
cd btget
bun install
bun run build
./dist/index.js --help
```

## 📖 Usage

### Download Command

To download a torrent, provide the path to the `.torrent` file. You can use the command directly (like `wget`) or with the `download` subcommand.

```bash
# Direct usage
btget <torrent-file> [options]

# Command-based usage
btget download <torrent-file> [options]

# Options
  -o, --output <directory>    Output directory (default: current directory)
  --dht-only                  Use only DHT for peer discovery (disable trackers)
  -h, --help                  Show help
```

**Examples:**

```bash
# Download to the current directory
btget movie.torrent

# Download to a specific directory
btget ubuntu.torrent -o ~/Downloads

# Download using only DHT (useful for testing or privacy)
btget ubuntu.torrent --dht-only
```

### Info Command

To inspect the contents and metadata of a `.torrent` file without downloading:

```bash
btget info <torrent-file>
```

**Example:**

```bash
btget info movie.torrent

# Example Output:
# 📁 Torrent Information:
#    Name: Big Buck Bunny
#    Size: 158.31 MB
#    Files: 1
#    Piece Length: 65536 bytes
#    Number of Pieces: 2417
#    Main Tracker: http://tracker.example.com/announce
```

## ⚡ Performance and Build

This project uses **Bun Build** to create a single, optimized executable. This approach provides several advantages:

- **Fast Startup**: By bundling all dependencies and leveraging Bun's native runtime, the CLI starts quickly.
- **Small Footprint**: Aggressive tree-shaking and minification result in a small bundle size.
- **Zero Runtime Dependencies**: The final build is a self-contained executable, making distribution simple.

The build process is configured to be fast and efficient, enabling a smooth development experience.

## 🛠️ Development

### Setup

After cloning the repository, install the dependencies using Bun:

```bash
# Clone the repository
git clone https://github.com/UtkarshTheDev/btget.git
cd btget

# Install dependencies
bun install
```

### Available Scripts

```bash
bun run build          # Build for production
bun run dev           # Development with hot reload
bun run test          # Run the test suite
bun run btget         # Build and run btget command
bun run download      # Build and run download command
bun run info          # Build and run info command
bun run lint          # Lint and check formatting
bun run format        # Format code
bun run typecheck     # Type checking only
bun run clean         # Remove build files
bun run rebuild       # Clean and rebuild
```

### Project Structure

```
src/
├── index.ts              # Main CLI entry point
├── core/                 # Core logic modules
│   ├── download.ts       # Download orchestrator
│   ├── handlers/         # Protocol handlers
│   └── modules/          # Feature modules (FileWriter, Progress, etc.)
├── dht/                  # Distributed Hash Table (DHT)
├── peers/                # Peer connection management
├── pieces/               # Piece handling and verification
├── protocol/             # BitTorrent protocol parsing
├── queue/                # Piece request queuing
├── tracker/              # Tracker communication
├── types/                # TypeScript type definitions
└── utils/                # General utilities
```

## 🧪 Testing

To run the test suite, use the following command:

```bash
bun test
```

This will execute all unit and integration tests located in the `test/` directory.

## 📋 Roadmap

- [x] **Resume Downloads**: Continue interrupted downloads (Auto-resume supported).
- [ ] **Seeding Support**: Share completed downloads.
- [ ] **Bandwidth Limiting**: Control upload/download speeds.
- [ ] **Magnet Link Support**: Download directly from magnet links.
- [x] **DHT Support**: Peer discovery via Distributed Hash Table.
- [ ] **Protocol Encryption**: Encrypt peer communication for privacy.
- [ ] **JSON Configuration**: Support for configuring BitTorrent connections and other settings via a JSON file.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

### Contribution Workflow

1. **Fork** the repository.
2. **Clone** your fork: `git clone https://github.com/yourusername/btget.git`
3. **Create** a branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes.
5. **Test** your changes: `bun test`
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to your fork: `git push origin feature/amazing-feature`
8. **Submit** a Pull Request.

### Areas for Contribution

- 🐛 **Bug Fixes**: Help squash bugs and improve stability.
- ✨ **New Features**: Implement items from the roadmap.
- 📚 **Documentation**: Improve guides and examples.
- 🧪 **Testing**: Add unit or integration tests.
- ⚡ **Performance**: Find and implement further optimizations.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **BitTorrent Protocol**: Bram Cohen and the BitTorrent community.
- **Bun**: The amazing Bun team for incredible performance.
- **TypeScript**: Microsoft and the TypeScript team.
- **Open Source Community**: All contributors and supporters.

## 📊 Stats

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=UtkarshTheDev/btget&type=Date)](https://star-history.com/#UtkarshTheDev/btget&Date)

![GitHub stars](https://img.shields.io/github/stars/UtkarshTheDev/btget?style=social)
![GitHub forks](https://img.shields.io/github/forks/UtkarshTheDev/btget?style=social)
![GitHub issues](https://img.shields.io/github/issues/UtkarshTheDev/btget)
![GitHub pull requests](https://img.shields.io/github/issues-pr/UtkarshTheDev/btget)

</div>

---

<div align="center">

**[⬆ back to top](#-btget---bittorrent-get-cli)**

Made with ❤️ by [UtkarshTheDev](https://github.com/UtkarshTheDev) and contributors

</div>