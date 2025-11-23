# URBTC Implementation Strategy (Go Edition)

## 🎯 Core Philosophy: "Performance by Default, Simplicity by Design"

This strategy outlines the development of URBTC using the **Go programming language**. This pivot from TypeScript to a compiled, concurrent-first language is a fundamental decision to ensure we meet our core goals of **performance, simplicity, and developer adaptability** from the ground up. Go's lightweight goroutines, performance, and straightforward syntax make it the ideal choice.

## 🛠️ Core Technology Stack

-   **Language**: Go
-   **BitTorrent Protocol**: `anacrolix/torrent` (a mature and highly performant library)
-   **CLI Framework**: `spf13/cobra` (powerful, standard library for CLIs)
-   **TUI Framework**: `charmbracelet/bubbletea` (modern, elegant, and highly performant TUI framework)
-   **Database**: `SQLite` (via `mattn/go-sqlite3`) for local metadata caching.

## 🚀 Phased Implementation Plan (Go-Based)

### Phase 1: The MVP - A Superior Core Experience (Months 1-3)
**Goal**: Build a functional, fast, and simple client that proves the core concepts.

-   **Tasks**:
    1.  **Core BitTorrent Engine**:
        -   Integrate the `anacrolix/torrent` library to handle core download/upload logic.
        -   Build a simple internal API to control torrent lifecycle (add, pause, remove, get stats).
    2.  **Lightning CLI (with `cobra`)**:
        -   Implement the essential commands: `urbtc get`, `list`, `add`, `remove`.
        -   Ensure all commands have a `--json` flag for scriptability from day one.
    3.  **Basic TUI (with `bubbletea`)**:
        -   Create a simple, read-only list view that shows active downloads and their progress.
        -   Implement basic add/remove torrent functionality.
    4.  **Smart Alias System (v1)**:
        -   Build the alias resolver.
        -   For official content, the resolver will fetch a `torrents.json` file from a CDN (e.g., GitHub Pages) and cache it locally in SQLite.
        -   This makes the `get` command feel instant for subsequent requests.
    5.  **Content Verification (SHA256)**:
        -   When adding torrents to the Community Store (API-only at this stage), the CLI will compute a SHA256 hash of the content.
        -   This hash will be stored alongside the torrent metadata, providing an extra layer of integrity that clients can verify post-download.

-   **Success Criteria**: `urbtc get ubuntu` works flawlessly. The CLI is responsive (<50ms). The TUI provides a stable, real-time view.

### Phase 2: Differentiation - The Developer's Choice (Months 4-6)
**Goal**: Add features that make URBTC indispensable for developers and power users.

-   **Tasks**:
    1.  **Community Store (Full Experience)**:
        -   Implement `urbtc store add` and `urbtc store browse` commands.
        -   Build out the backend API in Go to manage user-submitted content.
        -   The `urbtc get <alias>#id` command will now query this live API.
    2.  **Daemon Mode & REST API**:
        -   Architect the application to run as a background daemon (`urbtc daemon start`).
        -   Expose the core engine's internal API via a local REST API, enabling advanced scripting and third-party tool integration.
    3.  **Watch Mode Automation**:
        -   Implement `urbtc watch <directory>` to automatically add new `.torrent` files from a specified directory.
        -   Use Go's `fsnotify` library for efficient filesystem event handling.
    4.  **Bandwidth Management**:
        -   Expose simple controls from the underlying torrent library to limit global upload/download rates via `urbtc config`.
    5.  **Comprehensive Documentation**:
        -   Publish detailed documentation for the CLI commands and the REST API.

-   **Success Criteria**: The Community Store is live. Developers can automate their workflows using the REST API and watch mode.

### Phase 3: Polish & Extensibility (Months 7-12)
**Goal**: Refine the user experience, optimize performance, and open the platform to community extension.

-   **Tasks**:
    1.  **Advanced TUI**:
        -   Integrate full Vim-like navigation, command mode (`:`), and multi-pane management.
        -   Add `tmux`/`screen` integration to display status information in the terminal's title bar.
    2.  **Plugin System (Post-v1.0 Focus)**:
        -   Design a system for event-based hooks (e.g., `OnDownloadComplete`).
        -   Investigate a lightweight scripting layer using Lua or a WASM runtime (like `wazero` for Go) to allow users to write custom automation scripts.
    3.  **Peer Discovery Optimizations**:
        -   Enable and configure advanced peer discovery mechanisms supported by the core library, such as Local Peer Discovery (LPD) and WebRTC.
    4.  **Built-in Web Search**:
        -   Implement `urbtc search --web <query>` to scrape 1-2 pre-approved legal torrent indexers (e.g., Internet Archive) as a supplemental discovery method.
    5.  **Performance Benchmark Suite**:
        -   Create an automated suite that benchmarks URBTC against competitors (aria2c, qBittorrent) for speed, CPU, and memory usage.
        -   Integrate this into the CI/CD pipeline to prevent performance regressions.

-   **Success Criteria**: The TUI is a best-in-class terminal application. The client is measurably faster than competitors. A clear path for community plugins is established.
