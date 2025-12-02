# Logging and Debugging Guide

This guide explains how to use btget's comprehensive logging system for debugging and development.

## Quick Reference

```bash
# Basic debugging
btget file.torrent -o output --debug

# Verbose debugging  
btget file.torrent -o output --verbose

# Ultra-verbose (all operations)
btget file.torrent -o output --trace

# Filter by category
btget file.torrent -o output --debug --log-category=UPLOAD
btget file.torrent -o output --trace --log-category=PEER,TRACKER
```

## Log Levels

btget supports five log levels, from least to most verbose:

| Level | Flag | Description | Use Case |
|-------|------|-------------|----------|
| **ERROR** | `--log-level=ERROR` | Critical errors only | Production monitoring |
| **WARN** | `--log-level=WARN` | Warnings and errors | Identifying issues |
| **INFO** | `--debug` | Important milestones | General debugging |
| **DEBUG** | `--verbose` or `-v` | Detailed operations | Development |
| **TRACE** | `--trace` | Every operation | Deep debugging |

## Log Categories

Filter logs by subsystem to focus on specific areas:

| Category | Description | Example Logs |
|----------|-------------|--------------|
| **PEER** | Peer connections | Connection attempts, handshakes, disconnections |
| **UPLOAD** | Upload management | Choking decisions, piece serving, upload stats |
| **DOWNLOAD** | Download progress | Piece reception, download milestones |
| **DHT** | DHT operations | DHT lookups, peer discovery |
| **TRACKER** | Tracker communication | Announces, peer lists, tracker stats |
| **PIECE** | Piece verification | Hash checks, piece assembly |
| **QUEUE** | Request queue | Piece requests, queue management |
| **PROTOCOL** | Protocol messages | Message parsing, protocol events |
| **SYSTEM** | System events | Initialization, shutdown, errors |

## Usage Examples

### Basic Debugging

```bash
# Show all INFO level logs
btget ubuntu.torrent -o Downloads --debug

# Show all DEBUG level logs
btget ubuntu.torrent -o Downloads --verbose

# Show all TRACE level logs (very verbose!)
btget ubuntu.torrent -o Downloads --trace
```

### Category Filtering

```bash
# Only show TRACKER logs
btget ubuntu.torrent -o Downloads --debug --log-category=TRACKER

# Only show UPLOAD logs (to debug seeding)
btget ubuntu.torrent -o Downloads --trace --log-category=UPLOAD

# Show PEER and DOWNLOAD logs
btget ubuntu.torrent -o Downloads --verbose --log-category=PEER,DOWNLOAD

# Show all categories except one (not directly supported, use multiple)
btget ubuntu.torrent -o Downloads --debug --log-category=TRACKER,PEER,UPLOAD
```

### Level Filtering

```bash
# Only show warnings and errors
btget ubuntu.torrent -o Downloads --debug --log-level=WARN

# Only show errors
btget ubuntu.torrent -o Downloads --debug --log-level=ERROR

# Show DEBUG and above (DEBUG, INFO, WARN, ERROR)
btget ubuntu.torrent -o Downloads --debug --log-level=DEBUG
```

### Combined Filtering

```bash
# TRACE level, only UPLOAD category
btget ubuntu.torrent -o Downloads --trace --log-category=UPLOAD

# DEBUG level, only TRACKER and DHT
btget ubuntu.torrent -o Downloads --verbose --log-category=TRACKER,DHT

# WARN level and above, only PEER category
btget ubuntu.torrent -o Downloads --debug --log-category=PEER --log-level=WARN
```

## Common Debugging Scenarios

### Debugging Slow Downloads

```bash
# Check tracker communication
btget file.torrent -o output --verbose --log-category=TRACKER

# Check peer connections
btget file.torrent -o output --verbose --log-category=PEER

# Check download progress and queue
btget file.torrent -o output --verbose --log-category=DOWNLOAD,QUEUE
```

### Debugging Upload/Seeding Issues

```bash
# See all upload decisions (choking, piece serving)
btget file.torrent -o output --trace --log-category=UPLOAD

# See upload stats and peer requests
btget file.torrent -o output --verbose --log-category=UPLOAD,PEER
```

### Debugging Connection Problems

```bash
# See all peer connection attempts
btget file.torrent -o output --trace --log-category=PEER

# See tracker and DHT peer discovery
btget file.torrent -o output --verbose --log-category=TRACKER,DHT
```

### Debugging Hash Failures

```bash
# See piece verification
btget file.torrent -o output --verbose --log-category=PIECE

# See piece assembly and verification
btget file.torrent -o output --trace --log-category=PIECE,DOWNLOAD
```

## Log Output Format

Logs are formatted as:

```
[HH:MM:SS] [LEVEL] [CATEGORY] Message {data}
```

Example:
```
[12:34:56] [INFO] [DOWNLOAD] Download started {size=420.95 MB, pieces=842}
[12:34:57] [DEBUG] [TRACKER] Contacting 9 trackers
[12:34:58] [DEBUG] [PEER] Connected to peer {ip=1.2.3.4, port=6881}
[12:35:00] [DEBUG] [UPLOAD] Choking round summary {unchoked=4, choked=44, skipped=0, totalPeers=48}
[12:35:01] [TRACE] [UPLOAD] REQUEST from 1.2.3.4:6881 {piece=0, begin=0, length=16384}
```

## For Developers

### Adding Logs to Code

```typescript
import Logger, { LogCategory } from '../utils/logger';

// INFO - Major milestones
Logger.info(LogCategory.DOWNLOAD, 'Download started', { 
  size: '100 MB', 
  pieces: 400 
});

// DEBUG - Detailed operations
Logger.debug(LogCategory.PEER, 'Connected to peer', { 
  ip: '1.2.3.4', 
  port: 6881 
});

// TRACE - Individual operations
Logger.trace(LogCategory.UPLOAD, 'Serving block', { 
  piece: 0, 
  begin: 0, 
  length: 16384 
});

// WARN - Recoverable issues
Logger.warn(LogCategory.TRACKER, 'Tracker timeout', { 
  url: 'http://tracker.example.com' 
});

// ERROR - Serious problems
Logger.error(LogCategory.PIECE, 'Hash verification failed', { 
  piece: 42 
});
```

### Rate Limiting

Prevent log spam with rate limiting:

```typescript
// Only log once every 5 seconds
Logger.throttle('peer-connection', 5000, () => {
  Logger.debug(LogCategory.PEER, 'Peer connection attempt');
});
```

### Aggregate Statistics

Track metrics that are logged periodically:

```typescript
// Track total bytes uploaded (flushed every 30s)
Logger.aggregate('bytes_uploaded', blockSize);
```

## Tips

1. **Start broad, then narrow**: Begin with `--debug` to see all categories, then use `--log-category` to focus
2. **Use TRACE sparingly**: TRACE level generates massive output, use only for specific debugging
3. **Combine filters**: Use both category and level filtering for precise debugging
4. **Check upload logs after download starts**: UPLOAD logs only appear when peers request pieces from you

## Troubleshooting

**Q: I don't see any logs**
- Make sure you're using `--debug`, `--verbose`, or `--trace`
- Check that your category filter includes the logs you want to see

**Q: I see the TUI instead of logs**
- Use `--debug`, `--verbose`, or `--trace` to suppress the TUI
- The TUI is shown by default when no debug flags are used

**Q: I don't see UPLOAD logs**
- UPLOAD logs only appear when peers request pieces from you
- Wait for the download to progress and peers to connect
- Use `--trace` to see individual upload operations

**Q: Too many logs!**
- Use `--log-category` to filter by subsystem
- Use `--log-level=WARN` to only see warnings and errors
- Avoid `--trace` unless necessary
