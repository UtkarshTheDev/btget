# URBTC TUI Design - Vim-Friendly Beautiful Interface

## 🎯 TUI Philosophy: "Vim Power Meets Modern Beauty"

### Core Principles
- **Vim-First**: h/j/k/l navigation, : command mode, / search
- **Zero Learning Curve**: Vim users feel instantly at home
- **Beautiful & Fast**: 60fps updates with stunning visuals
- **Feature Rich**: Everything CLI has + visual store browsing
- **Keyboard Driven**: Mouse optional, keyboard optimal

## 🚀 Entry Point: Just Type `urbtc`

```bash
# Default behavior - enter TUI mode
$ urbtc                    # Beautiful visual interface
$ urbtc get ubuntu         # Stay in CLI for quick tasks
$ urbtc --cli get ubuntu   # Force CLI mode
```

## 🖥️ Main TUI Layout Architecture

### Primary Interface (Default View)
```
┌─ URBTC v1.0 - Ultra Rapid BitTorrent Client ────────────────────────┐
│ Mode: [Normal] • Pane: Downloads • [?] Help • [q] Quit • [:] Command │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─[1] Downloads ──────────────────┐ ┌─[2] Store Browser ────────────┐ │
│ │ 🎯 Focus: Active (3) ⬇️         │ │ 📂 Category: All              │ │
│ │                                 │ │                               │ │
│ │ >🔥 ubuntu-server        85.2%  │ │ >🌟 ubuntu          Official   │ │
│ │   ████████████████████████████▓ │ │  📄 Ubuntu 22.04.3 LTS       │ │
│ │   💾 2.1GB/2.5GB ⚡8.1MB/s     │ │                               │ │
│ │   👥 S:45 P:89 📍 4min left    │ │  🌟 fedora          Official   │ │
│ │                                 │ │  📄 Fedora 39 Workstation    │ │
│ │  📦 docker-dev#4829      42.7%  │ │                               │ │
│ │   ████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ >👥 docker-dev#4829  ⭐4.8   │ │
│ │   💾 892MB/2.1GB ⚡6.8MB/s     │ │  📄 Custom Docker Environment │ │
│ │   👥 S:12 P:67 📍 12min left   │ │  🏷️  Dev Tools              │ │
│ │                                 │ │                               │ │
│ │  ✅ fedora-38           100%    │ │  👥 react-starter#1337 ⭐4.6  │ │
│ │   💾 2.1GB 📁 ~/Downloads/     │ │  📄 React.js Boilerplate     │ │
│ │                                 │ │  🏷️  Templates              │ │
│ └─ [Space] Pause [d] Remove ─────┘ └─ [Enter] Download [/] Search ─┘ │
│ ┌─[3] Activity Stream ─────────────────────────────────────────────── │ │
│ │ [15:42:35] ✅ docker-dev#4829: Piece 1847 verified (203.45.67.89) │ │
│ │ [15:42:33] 🆕 Store: react-starter#1337 added by @dev_master      │ │
│ │ [15:42:31] 🚀 ubuntu-server: Speed boost to 12.3 MB/s            │ │
│ │ [15:42:28] 📊 System: RAM 67MB, Cache 45MB, Peers 156           │ │
│ └─ [g] Filter [c] Clear ────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ 📊 ↓ 14.9MB/s ↑ 2.3MB/s │ 👥 156 peers │ 🧠 67MB │ 📦 2.1TB total    │
│ ⚡ Quick Actions: [g]et [s]earch [c]onfig [h]elp [:]command mode    │
└──────────────────────────────────────────────────────────────────────┘
```

## 🎮 Vim-Inspired Key Bindings

### Movement & Navigation (Pure Vim)
```
📍 Basic Movement:
├─ h/j/k/l          # Navigate within panes (left/down/up/right)
├─ Tab / Shift+Tab  # Switch between panes (forward/backward)
├─ Ctrl+w w         # Cycle through panes (vim window commands)
├─ Ctrl+w h/j/k/l   # Move to specific pane direction
└─ gg / G           # Go to top/bottom of current pane

🎯 Selection & Actions:
├─ Enter            # Select/Download/Activate item
├─ Space            # Toggle pause/resume
├─ d / dd           # Delete/Remove current item
├─ y                # Copy (item info to clipboard)
├─ p                # Paste (in command mode)
└─ o / O            # Open in new mode / Open above

🔍 Search & Filter:
├─ /                # Search in current pane
├─ n / N            # Next/Previous search result
├─ *                # Search for word under cursor
├─ f<char>          # Find character in line (vim f command)
└─ ; / ,            # Repeat find forward/backward
```

### Command Mode (Vim : Commands)
```
💻 Command Mode (Press :):
├─ :get ubuntu             # Download Ubuntu (CLI in TUI)
├─ :store search docker    # Search store
├─ :pause all             # Pause all downloads
├─ :resume <name>         # Resume specific download
├─ :remove <pattern>      # Remove matching downloads
├─ :config <setting>      # Change configuration
├─ :theme dark/light      # Switch theme
├─ :help <topic>          # Get help
├─ :quit / :q             # Exit to terminal
└─ :split / :vsplit       # Split panes
```

### Advanced Vim Features
```
🔥 Power User Features:
├─ v                # Visual mode (multi-select)
├─ V                # Visual line mode
├─ Ctrl+v           # Visual block mode
├─ .                # Repeat last action
├─ u                # Undo last action
├─ Ctrl+r           # Redo
├─ m<letter>        # Set mark
├─ '<letter>        # Jump to mark
├─ %                # Jump to matching item
└─ Ctrl+o/i         # Jump back/forward in history

📚 Registers (Vim-style):
├─ "<register>y     # Copy to named register
├─ "<register>p     # Paste from named register
├─ :reg             # Show all registers
└─ "+y              # Copy to system clipboard
```

## 🏪 Store Browser Pane Features

### Category Navigation
```
┌─ Store Browser ────────────────────────────────────────────────────────┐
│ 📂 [All] Official Community Featured Trending New                     │
├────────────────────────────────────────────────────────────────────────┤
│ 🌟 Official Content (12 items)                                        │
│ >  ubuntu              📄 Ubuntu 22.04.3 LTS Desktop      4.7GB      │
│    ubuntu-server       📄 Ubuntu 22.04.3 LTS Server       1.4GB      │
│    fedora              📄 Fedora 39 Workstation           2.1GB      │
│    arch                📄 Arch Linux Latest               800MB      │
│    debian              📄 Debian 12 Bookworm              3.7GB      │
│                                                                        │
│ 👥 Community Content (4,829 items)                                    │
│ >  docker-dev#4829     📄 Custom Docker Environment      ⭐4.8  1.2GB │
│    react-starter#1337  📄 React.js Boilerplate          ⭐4.6   45MB │
│    ml-dataset#9999     📄 ML Training Dataset            ⭐4.9  8.5GB │
│    game-assets#5555    📄 Unity Game Assets              ⭐4.3  2.3GB │
│                                                                        │
│ [Enter] Download [i] Info [r] Rate [/] Search [f] Filter              │
└────────────────────────────────────────────────────────────────────────┘

Vim Navigation in Store:
├─ j/k              # Navigate items
├─ /                # Search store
├─ f                # Filter by category
├─ o                # Open item details
├─ Enter            # Download selected item
└─ i                # Show detailed info
```

### Advanced Store Features
```
🔍 Search & Discovery:
├─ /docker          # Search for "docker" content
├─ /category:dev    # Filter by category
├─ /rating:>4.5     # Filter by rating
├─ /size:<100MB     # Filter by size
└─ /official        # Show only official content

⭐ Rating & Community:
├─ r 1-5            # Rate current item (1-5 stars)
├─ c                # Add comment/review
├─ f                # Mark as favorite
├─ s                # Share item
└─ R                # Report inappropriate content

📊 Sorting Options:
├─ :sort rating     # Sort by rating
├─ :sort size       # Sort by file size
├─ :sort date       # Sort by upload date
├─ :sort downloads  # Sort by popularity
└─ :sort name       # Sort alphabetically
```

## 📊 Downloads Pane Advanced Features

### Download Management
```
┌─ Downloads Pane ───────────────────────────────────────────────────────┐
│ 📊 [All] Active Paused Completed Seeding                              │
├────────────────────────────────────────────────────────────────────────┤
│ 🔥 Active Downloads (3)                                                │
│ >  ubuntu-server          85.2%  ████████████████████████████▓▓▓      │
│    💾 2.1GB/2.5GB  ⚡8.1MB/s ⬆1.2MB/s  👥S:45 P:89  ⏱4min left     │
│    📍 ~/Downloads/ISOs/ubuntu-server-22.04.3.iso                     │
│    🎯 Priority: High  🔄 Ratio: 0.8  📊 Availability: 98%            │
│                                                                        │
│    docker-dev#4829        42.7%  ████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│    💾 892MB/2.1GB  ⚡6.8MB/s ⬆0.4MB/s  👥S:12 P:67  ⏱12min left    │
│    📍 ~/Downloads/Docker/docker-dev-environment.tar                  │
│    🎯 Priority: Normal  🔄 Ratio: 1.2  📊 Availability: 67%          │
│                                                                        │
│ ✅ Completed (5)                                                       │
│    fedora-38              100%   ████████████████████████████████████ │
│    💾 2.1GB  🔄 Ratio: 2.4  📅 Completed: 2h ago                    │
│                                                                        │
│ [Space] Pause [+/-] Priority [Enter] Details [m] Move                 │
└────────────────────────────────────────────────────────────────────────┘

Advanced Controls:
├─ Space            # Toggle pause/resume
├─ +/-              # Increase/decrease priority  
├─ m                # Move to different folder
├─ Enter            # Show detailed information
├─ v                # Verify integrity
├─ f                # Force start
├─ s                # Stop (not pause)
└─ d                # Remove (with confirmation)
```

### Detailed Item View
```
┌─ Download Details: ubuntu-server ──────────────────────────────────────┐
│                                                                         │
│ 📦 Ubuntu 22.04.3 LTS Server                                          │
│ 🌐 Source: Official Ubuntu Release                                     │
│ 💾 Size: 2.5GB (2,684,354,560 bytes)                                  │
│ 📊 Progress: 85.2% (2,287,230,197 bytes downloaded)                   │
│ ⚡ Speed: ↓ 8.1 MB/s ↑ 1.2 MB/s                                       │
│ 👥 Peers: 45 seeders, 89 leechers                                     │
│ 🔄 Ratio: 0.8 (uploaded 2.1GB)                                        │
│ 📍 Location: ~/Downloads/ISOs/ubuntu-server-22.04.3.iso               │
│ ⏱️ ETA: 4 minutes 23 seconds                                          │
│ 📅 Added: 2023-12-10 15:30:45                                         │
│ 🎯 Priority: High                                                      │
│                                                                         │
│ 🧩 Pieces: 1,024 pieces, 20,480 bytes each                           │
│ ✅ Verified: 872/1,024 pieces (85.2%)                                 │
│ 🔄 Downloading: pieces 873-876 (from peer 203.45.67.89)              │
│                                                                         │
│ 🌐 Trackers:                                                           │
│ ├─ ✅ torrent.ubuntu.com:6969 (45 peers)                              │
│ ├─ ✅ ipv6.torrent.ubuntu.com:6969 (23 peers)                         │
│ └─ ⚠️  backup.ubuntu.com:6969 (timeout)                               │
│                                                                         │
│ [Esc] Back [p] Pause [v] Verify [m] Move [d] Delete                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🎨 Themes & Visual Design

### Color Schemes
```typescript
// Dark Theme (Default)
const DARK_THEME = {
  background: '#1e1e1e',
  foreground: '#ffffff',
  accent: '#00ff87',      // Bright green for active items
  secondary: '#00d7ff',   // Cyan for secondary info
  success: '#00ff00',     // Green for completed
  warning: '#ffff00',     // Yellow for warnings
  error: '#ff0000',       // Red for errors
  muted: '#666666',       // Gray for inactive
  border: '#333333',      // Dark gray for borders
  highlight: '#2d2d2d'    // Slightly lighter for selection
};

// Light Theme
const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#000000',
  accent: '#0066cc',      // Blue for active items
  secondary: '#6600cc',   // Purple for secondary
  success: '#008800',     // Green for completed
  warning: '#cc6600',     // Orange for warnings
  error: '#cc0000',       // Red for errors
  muted: '#999999',       // Gray for inactive
  border: '#cccccc',      // Light gray for borders
  highlight: '#f0f0f0'    // Light gray for selection
};

// Vim Theme (Classic)
const VIM_THEME = {
  background: '#000000',  // Pure black
  foreground: '#ffffff',  // Pure white
  accent: '#ffffff',      // White for consistency
  secondary: '#cccccc',   // Light gray
  success: '#ffffff',     // White (minimal)
  warning: '#ffffff',     # White (minimal)
  error: '#ffffff',       # White (minimal)
  muted: '#666666',      # Dark gray
  border: '#ffffff',     # White borders
  highlight: '#333333'   # Dark highlight
};
```

### Visual Indicators & Icons
```
📊 Progress Indicators:
├─ ████████████████████ # Completed sections
├─ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ # Partially downloaded
├─ ░░░░░░░░░░░░░░░░░░░░ # Not downloaded
└─ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ # Verifying

🎯 Status Icons:
├─ 🔥 # Actively downloading
├─ ⏸️ # Paused
├─ ✅ # Completed
├─ 🌱 # Seeding
├─ ⚠️ # Warning/Error
├─ 📦 # Queued
├─ 🔄 # Verifying
└─ 💤 # Inactive

🏪 Store Icons:
├─ 🌟 # Official content
├─ 👥 # Community content
├─ ⭐ # Rating stars
├─ 🔥 # Trending
├─ 🆕 # New content
├─ 🏷️ # Categories/Tags
└─ 📄 # Description/Info
```

## 🚀 Performance & Optimization

### 60fps Rendering Strategy
```typescript
// Efficient TUI Rendering
class TUIRenderer {
  private frameRate = 60;
  private lastRender = 0;
  private dirtyPanes = new Set<string>();
  
  // Only render when necessary
  requestRender(pane?: string): void {
    if (pane) this.dirtyPanes.add(pane);
    
    const now = Date.now();
    const timeSinceLastRender = now - this.lastRender;
    const minFrameTime = 1000 / this.frameRate;
    
    if (timeSinceLastRender >= minFrameTime) {
      this.render();
    }
  }
  
  // Smart rendering - only update changed areas
  private render(): void {
    for (const pane of this.dirtyPanes) {
      this.renderPane(pane);
    }
    this.dirtyPanes.clear();
    this.lastRender = Date.now();
  }
}

// Memory-efficient updates
class LiveDataManager {
  // Update only when significant changes occur
  shouldUpdate(oldData: any, newData: any): boolean {
    return (
      Math.abs(oldData.progress - newData.progress) > 0.1 || // 0.1% change
      Math.abs(oldData.speed - newData.speed) > 100000 ||    // 100KB change
      oldData.status !== newData.status                      // Status change
    );
  }
}
```

### Keyboard Input Optimization
```typescript
// Vim-inspired key handling
class VimKeyHandler {
  private mode: 'normal' | 'command' | 'visual' = 'normal';
  private keyBuffer: string = '';
  private commandHistory: string[] = [];
  
  handleKeyPress(key: string): void {
    switch (this.mode) {
      case 'normal':
        this.handleNormalMode(key);
        break;
      case 'command':
        this.handleCommandMode(key);
        break;
      case 'visual':
        this.handleVisualMode(key);
        break;
    }
  }
  
  private handleNormalMode(key: string): void {
    // Vim movement
    switch (key) {
      case 'h': this.moveLeft(); break;
      case 'j': this.moveDown(); break;
      case 'k': this.moveUp(); break;
      case 'l': this.moveRight(); break;
      case ':': this.enterCommandMode(); break;
      case '/': this.enterSearchMode(); break;
      case 'g': this.handleGCommand(); break;
      // ... more vim commands
    }
  }
}
```

## 🔧 Configuration & Customization

### TUI Configuration
```yaml
# ~/.config/urbtc/tui.yaml
tui:
  theme: dark                    # dark, light, vim, custom
  refresh_rate: 60              # FPS for updates
  vim_mode: true                # Enable full vim compatibility
  
  panes:
    downloads:
      default_view: active      # active, all, completed
      show_details: true        # Show extended info
      auto_refresh: true        # Auto-update progress
    
    store:
      default_category: all     # all, official, community  
      items_per_page: 20        # Items to show
      show_ratings: true        # Display star ratings
    
    activity:
      max_lines: 100           # Activity log history
      auto_scroll: true        # Follow new entries
      
  keybindings:
    quit: 'q'                  # Quit to terminal
    help: '?'                  # Show help overlay
    command_mode: ':'          # Enter command mode
    search: '/'                # Search current pane
    # Custom bindings
    quick_get: 'g'             # Quick download prompt
    toggle_pause: 'space'      # Pause/resume toggle

  appearance:
    borders: true              # Show pane borders
    status_bar: true           # Show status bar
    animations: true           # Enable transitions
    unicode: true              # Use Unicode symbols
```

This TUI design creates a powerful, vim-friendly interface that maintains the simplicity philosophy while providing rich visual management capabilities that the CLI alone cannot offer.