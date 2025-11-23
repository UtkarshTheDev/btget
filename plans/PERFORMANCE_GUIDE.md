# URBTC Performance Guide (Go Edition)

## 🎯 Guiding Philosophy: Performance by Default

In URBTC, performance is the primary architectural driver. Our choice of **Go** as the implementation language is deliberate, as its core features of lightweight concurrency (goroutines) and explicit, well-defined communication (channels) allow us to build a massively concurrent, high-throughput application with simplicity and clarity.

This guide outlines how we leverage Go's strengths to meet our ambitious performance targets: a **sub-50ms CLI**, **>95% bandwidth utilization**, and a **60fps TUI**.

## 🚀 Core Performance Strategies in Go

### 1. Concurrency: Goroutines and Channels (The Heart of URBTC)

**Problem**: A BitTorrent client must simultaneously handle network I/O with hundreds of peers, manage disk I/O, and update the UI without any of them blocking the others.

**Go Solution**: We use goroutines extensively. Every peer connection, every torrent, and every major subsystem (like the TUI or API server) runs in its own goroutine.

-   **Massive Parallelism**: A single URBTC instance can manage thousands of goroutines with minimal memory overhead (a few KBs each), allowing for extreme concurrency.
-   **No More Callback Hell**: Unlike Node.js, there is no "main thread" to block. Asynchronous operations are handled cleanly with channels, leading to simpler, more readable, and more performant code.
-   **Clear Communication**: Channels provide a safe, explicit way for goroutines to communicate, preventing race conditions and simplifying complex state management between the network layer, disk layer, and UI.

```go
// Simplified example of a torrent manager
// src/core/engine.go

func (e *Engine) manageTorrent(t *Torrent) {
    // Each torrent is managed in its own goroutine
    go func() {
        for {
            select {
            case update := <-t.Updates():
                // Non-blocking update handling
                e.ui.Send(update) // Send update to TUI via a channel
            case <-t.Closed():
                return // Exit when torrent is closed
            }
        }
    }()
}
```

### 2. Network I/O: Maximum Throughput

**Goal**: Saturate the user's available bandwidth.

**Go Implementation**:
The `anacrolix/torrent` library is already heavily optimized for high-performance networking in Go. We build on this foundation by:

-   **Fine-tuning Buffers**: We will expose configuration to tune read/write buffer sizes for network sockets, allowing power users to optimize for their specific network conditions.
-   **Intelligent Peer Management**: Our core engine will add a layer on top of the library to score and manage peer connections, prioritizing those that provide the best download rates and ensuring we are always connected to the most productive peers. Go's concurrency makes it trivial to manage these connections in parallel.

### 3. CPU Usage: Offloading Heavy Work

**Problem**: Piece verification (SHA-1 hashing) is CPU-intensive and can block the main thread in other runtimes, causing UI stutter and poor responsiveness.

**Go Solution**: This is a non-issue in our architecture. The `anacrolix/torrent` library automatically handles piece verification in separate goroutines. The OS scheduler efficiently distributes this work across all available CPU cores.

-   **Benefit**: The UI and core application logic remain perfectly responsive, even under heavy download load. The performance scales linearly with the number of available CPU cores.

### 4. Disk I/O: Never the Bottleneck

**Goal**: Ensure the disk can keep up with multi-gigabit download speeds.

**Go Implementation**:
`anacrolix/torrent` provides options for high-performance storage interfaces. Our strategy is:

-   **Asynchronous by Default**: All disk I/O is handled by the torrent library in dedicated goroutines, ensuring it never blocks critical networking or UI code.
-   **Read-Ahead Caching**: We will configure a read-ahead cache for pieces that are frequently requested by peers (in seeding mode), reducing disk reads and improving upload performance.
-   **Write Caching**: The library handles write-back caching, batching writes of completed pieces to disk. This converts many small, random writes into larger, sequential writes, which is significantly more efficient.

## 📊 Performance Benchmarks & Targets

Our choice of Go makes these targets not just aspirational, but achievable and verifiable.

-   **CLI Command Latency**: `<50ms`. Achieved by the fast startup of Go applications and minimal overhead.
-   **TUI Refresh Rate**: `60fps`. Possible because the UI runs in a separate goroutine from all backend logic and communicates via non-blocking channels.
-   **Bandwidth Utilization**: `>95%`. Achieved via Go's highly efficient networking and I/O handling.
-   **Memory Usage**: `<50MB` base + `<25MB` per torrent. Go's efficient memory management and lightweight goroutines make this possible.
-   **Concurrent Torrents**: 1000+. The goroutine-per-torrent model is designed to scale to a massive number of active torrents with minimal performance degradation.

This guide will be continuously updated as we develop our benchmark suite and gather real-world performance data.
