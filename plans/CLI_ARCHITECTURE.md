# URBTC CLI Architecture - Lightning Fast Commands

## 🚀 CLI Philosophy: "Lightning Speed + Smart Defaults"

### Core Principles
- **Sub-50ms Response**: Every command feels instant
- **Smart Aliases**: Official content without IDs, community with IDs
- **Zero Config**: Works perfectly out of the box
- **Pipe Friendly**: JSON output for scripting integration
- **Progressive Disclosure**: Simple commands, advanced flags when needed

## ⚡ Command Structure & Hierarchy

### Essential Commands (5 Core Commands)
```bash
# Primary Commands (90% of usage)
urbtc get <alias>           # Download official or community content
urbtc list [filter]         # Show downloads with beautiful progress
urbtc pause <name>          # Pause specific downloads
urbtc resume <name>         # Resume specific downloads  
urbtc remove <name>         # Remove downloads

# Store Commands (Community marketplace)
urbtc store add <alias> <torrent>    # Add content to community store
urbtc store list [category]          # Browse store content
urbtc store search <query>           # Search store

# Advanced Commands (Power users)
urbtc                       # Enter TUI mode (default with no args)
urbtc daemon [action]       # Background service management
urbtc config [key] [value]  # Configuration management
```

## 🧠 Smart Alias System Architecture

### Official Content (No ID Required)
```bash
# Linux Distributions - Auto-resolves to latest stable
urbtc get ubuntu            # Ubuntu 22.04.3 LTS Desktop
urbtc get ubuntu-server     # Ubuntu 22.04.3 LTS Server
urbtc get fedora            # Fedora 39 Workstation
urbtc get arch              # Arch Linux latest ISO
urbtc get debian            # Debian 12 Bookworm stable

# Development Tools
urbtc get docker            # Docker Desktop latest
urbtc get node              # Node.js latest LTS
urbtc get python            # Python latest stable
urbtc get golang            # Go latest stable

# Popular Software
urbtc get vlc               # VLC Media Player latest
urbtc get firefox           # Firefox Browser latest
urbtc get blender           # Blender 3D latest
urbtc get libreoffice       # LibreOffice Suite latest

# Legal Media Content
urbtc get big-buck-bunny    # Big Buck Bunny movie
urbtc get sintel            # Sintel movie
urbtc get tears-of-steel    # Tears of Steel movie
```

### Community Content (With Unique IDs)
```bash
# Format: <category-name>#<unique-id>
urbtc get docker-dev#4829        # Custom Docker development environment
urbtc get react-starter#1337     # React.js project boilerplate
urbtc get ml-dataset#9999        # Machine learning training data
urbtc get game-assets#5555       # Unity game development assets
urbtc get linux-config#7777      # Custom Linux dotfiles
urbtc get kubernetes-setup#2468  # K8s cluster configuration

# Category Examples:
# docker-*, react-*, ml-*, game-*, linux-*, k8s-*, 
# python-*, rust-*, go-*, java-*, web-*, mobile-*
```

## 🎯 Intelligent Content Resolution

### Smart Matching Algorithm
```typescript
class ContentResolver {
  async resolve(alias: string): Promise<ContentSource> {
    // 1. Check for exact official match
    const official = this.getOfficialContent(alias);
    if (official) return official;
    
    // 2. Check for community content with ID
    if (this.hasIdFormat(alias)) {
      return this.getCommunityContent(alias);
    }
    
    // 3. Fuzzy match official content
    const fuzzyOfficial = this.fuzzyMatchOfficial(alias);
    if (fuzzyOfficial) return fuzzyOfficial;
    
    // 4. Search community store
    const communityMatches = await this.searchCommunity(alias);
    if (communityMatches.length === 1) {
      return communityMatches[0];
    } else if (communityMatches.length > 1) {
      return this.promptUserSelection(communityMatches);
    }
    
    // 5. No matches found
    throw new ContentNotFoundError(alias, this.getSuggestions(alias));
  }
  
  private getSuggestions(alias: string): string[] {
    return [
      ...this.getSimilarOfficial(alias),
      ...this.getSimilarCommunity(alias),
      'Try: urbtc store search ' + alias
    ];
  }
}
```

### Content Database Architecture
```typescript
// Built-in Official Content Database
const OFFICIAL_CONTENT: ContentDatabase = {
  'ubuntu': {
    name: 'Ubuntu 22.04.3 LTS Desktop',
    category: 'linux',
    source: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.3-desktop-amd64.iso.torrent',
    size: '4.7GB',
    verified: true,
    description: 'Popular Linux distribution for desktop users',
    tags: ['linux', 'desktop', 'lts', 'ubuntu'],
    auto_update: true,  // Keep URL updated to latest
    alternatives: ['ubuntu-server', 'ubuntu-desktop']
  },
  
  'ubuntu-server': {
    name: 'Ubuntu 22.04.3 LTS Server',
    category: 'linux',
    source: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso.torrent',
    size: '1.4GB',
    verified: true,
    description: 'Ubuntu Server for cloud and server deployments',
    tags: ['linux', 'server', 'lts', 'ubuntu', 'cloud'],
    auto_update: true
  },
  
  // ... more official content
};

// Community Store Integration
interface CommunityStore {
  search(query: string): Promise<ContentItem[]>;
  get(alias: string): Promise<ContentItem>;
  add(alias: string, content: TorrentFile): Promise<StoreResult>;
  verify(alias: string): Promise<VerificationResult>;
}
```

## 🔥 Advanced Get Command Implementation

### Smart Get Command
```typescript
class GetCommand {
  async execute(alias: string, options: GetOptions): Promise<void> {
    try {
      // Smart content resolution
      const content = await this.resolver.resolve(alias);
      
      // Smart download location
      const downloadPath = this.getSmartLocation(content, options);
      
      // Beautiful progress display
      const progress = new ProgressDisplay(content.name);
      
      // Start download with optimization
      const download = await this.downloadManager.start(
        content,
        downloadPath,
        {
          priority: this.calculatePriority(content),
          bandwidth: this.calculateBandwidthLimit(content),
          connections: this.getOptimalConnections()
        }
      );
      
      // Real-time progress updates
      download.onProgress((data) => {
        progress.update(data);
      });
      
      await download.complete();
      this.showSuccessMessage(content, downloadPath);
      
    } catch (error) {
      this.handleError(error, alias);
    }
  }
  
  private getSmartLocation(content: ContentItem, options: GetOptions): string {
    if (options.output) return options.output;
    
    // Smart location based on content type
    const baseDir = this.config.get('download.directory') || '~/Downloads';
    
    switch (content.category) {
      case 'linux':
        return path.join(baseDir, 'ISOs', content.filename);
      case 'software':
        return path.join(baseDir, 'Software', content.filename);
      case 'docker':
        return path.join(baseDir, 'Docker', content.filename);
      case 'datasets':
        return path.join(baseDir, 'Data', content.filename);
      default:
        return path.join(baseDir, content.filename);
    }
  }
}
```

### Get Command Options & Flags
```bash
# Basic Usage
urbtc get ubuntu                    # Simple download

# Advanced Options
urbtc get ubuntu --output ~/iso/    # Custom download location
urbtc get ubuntu --limit 5MB/s      # Bandwidth limit
urbtc get ubuntu --priority high    # Download priority
urbtc get ubuntu --sequential       # Sequential download (for streaming)
urbtc get ubuntu --pause           # Add but don't start
urbtc get ubuntu --verify          # Extra verification
urbtc get ubuntu --json            # JSON output for scripts

# Multiple Downloads
urbtc get ubuntu fedora arch        # Download multiple items
urbtc get "docker-*" --pattern      # Pattern matching (community store)

# Store Integration
urbtc get --store-only docker       # Search only community store
urbtc get --official-only ubuntu    # Search only official content
urbtc get --category linux          # Filter by category
```

## 📊 List Command with Advanced Filtering

### Powerful List Implementation
```bash
# Basic List Views
urbtc list                          # All downloads
urbtc list active                   # Only active downloads
urbtc list completed               # Only completed downloads
urbtc list paused                  # Only paused downloads
urbtc list seeding                 # Currently seeding

# Advanced Filtering
urbtc list --size ">1GB"           # Large files only
urbtc list --speed ">5MB/s"        # Fast downloads only
urbtc list --ratio ">1.0"          # Well-seeded downloads
urbtc list --category linux        # Linux ISOs only
urbtc list --added today           # Added today
urbtc list --completed "last week" # Completed recently

# Sorting Options
urbtc list --sort name             # Sort by name
urbtc list --sort size             # Sort by file size
urbtc list --sort speed            # Sort by download speed
urbtc list --sort progress         # Sort by completion
urbtc list --sort added            # Sort by date added
urbtc list --reverse               # Reverse sort order

# Output Formats
urbtc list --json                  # Machine readable
urbtc list --minimal               # Compact view
urbtc list --detailed              # Full information
urbtc list --watch                 # Live updating view
```

### Beautiful List Output Format
```
$ urbtc list

📥 Active Downloads (3)
┌──────────────────────────────────────────────────────────────────────┐
│ 🔥 ubuntu-server          ████████████████████████████▓▓▓▓  85.2%     │
│    💾 2.1GB/2.5GB  ⚡8.1MB/s ⬆1.2MB/s  👥45S/89P  ⏱4min            │
│    📍 ~/Downloads/ISOs/ubuntu-server-22.04.3.iso                    │
│                                                                      │
│ 📦 docker-dev#4829        ████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  42.7%     │
│    💾 892MB/2.1GB  ⚡6.8MB/s ⬆0.4MB/s  👥12S/67P  ⏱12min           │
│    📍 ~/Downloads/Docker/docker-dev-environment.tar                 │
│                                                                      │
│ ⏸️ ml-dataset#9999        ████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  25.3%     │
│    💾 2.1GB/8.5GB  Paused  👥89S/234P                              │
│    📍 ~/Downloads/Data/machine-learning-dataset.tar.gz              │
└──────────────────────────────────────────────────────────────────────┘

✅ Completed Today (2)
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ fedora-39               2.1GB  🔄1.8  📅2h ago                     │
│   📍 ~/Downloads/ISOs/fedora-39-workstation.iso                     │
│                                                                      │
│ ✓ vlc-player              45MB   🔄2.1  📅4h ago                     │
│   📍 ~/Downloads/Software/vlc-3.0.20-win64.exe                     │
└──────────────────────────────────────────────────────────────────────┘

📊 Summary: ↓ 14.9MB/s ↑ 1.6MB/s • 156 peers • 67MB RAM • 2.1TB total

💡 Commands: pause <name>, resume <name>, remove <name>
💡 Use: urbtc list --help for filtering options
```

## 🏪 Store Command Suite

### Store Management Commands
```bash
# Browse Store
urbtc store list                    # Popular content
urbtc store list --category docker  # Browse by category  
urbtc store list --official         # Official content only
urbtc store list --community        # Community content only
urbtc store list --featured         # Featured content
urbtc store list --trending         # Trending content
urbtc store list --new              # Recently added

# Search Store
urbtc store search docker           # Search for Docker content
urbtc store search "react starter"  # Multi-word search
urbtc store search --category dev   # Search within category
urbtc store search --rating ">4.5"  # High-rated content only

# Content Management
urbtc store add docker-custom#4829 ./my-docker.torrent
urbtc store add --category datasets ml-data#7777 magnet:?xt=...
urbtc store info docker-custom#4829     # Detailed information
urbtc store rate docker-custom#4829 5   # Rate content (1-5 stars)
urbtc store report docker-custom#4829   # Report inappropriate content

# Personal Store Management
urbtc store my                      # My uploaded content
urbtc store favorites              # Bookmarked content
urbtc store downloads              # My download history
urbtc store stats                  # My contribution statistics
```

### Store Output Examples
```
$ urbtc store list --category docker

🏪 URBTC Store - Docker Category (127 items)

🌟 Official Content
┌──────────────────────────────────────────────────────────────────────┐
│ docker                   📄 Docker Desktop Latest           🔄Auto    │
│ docker-compose          📄 Docker Compose Standalone        🔄Auto    │
└──────────────────────────────────────────────────────────────────────┘

👥 Community Content (125 items)
┌──────────────────────────────────────────────────────────────────────┐
│ docker-dev#4829         📄 Custom Development Environment  ⭐4.8      │
│   💾 1.2GB  👤 @kubernetes-expert  📅 2 days ago                    │
│   🏷️  Development, DevOps, Container Orchestration                  │
│                                                                      │
│ docker-nginx#1337       📄 Nginx with SSL Configuration    ⭐4.6      │
│   💾 45MB   👤 @nginx-master       📅 1 week ago                    │
│   🏷️  Web Server, SSL, Production Ready                            │
│                                                                      │
│ docker-ml#9999          📄 Machine Learning Stack          ⭐4.9      │
│   💾 3.2GB  👤 @ml-researcher      📅 3 days ago                    │
│   🏷️  TensorFlow, PyTorch, Jupyter, GPU Support                    │
└──────────────────────────────────────────────────────────────────────┘

💡 Commands: [Enter] Download, [i] Info, [r] Rate, [f] Favorite
💡 Use: urbtc get <alias> to download any item
```

## 🔧 Advanced CLI Features

### Configuration Management
```bash
# View Configuration
urbtc config                        # Show all settings
urbtc config download               # Show download settings
urbtc config download.directory     # Show specific setting

# Modify Configuration  
urbtc config download.directory ~/torrents      # Set download directory
urbtc config download.max-connections 100      # Set max connections
urbtc config bandwidth.download-limit 10MB/s   # Set download limit
urbtc config ui.theme dark                     # Set theme

# Advanced Configuration
urbtc config --list                 # List all available settings
urbtc config --reset               # Reset to defaults
urbtc config --export config.yaml  # Export configuration
urbtc config --import config.yaml  # Import configuration
urbtc config --validate           # Validate current config
```

### Daemon Management
```bash
# Daemon Control
urbtc daemon start                  # Start background service
urbtc daemon stop                   # Stop background service
urbtc daemon restart               # Restart service
urbtc daemon status                # Show daemon status
urbtc daemon logs                  # Show daemon logs

# Daemon Configuration
urbtc daemon start --port 8080      # Custom API port
urbtc daemon start --bind 0.0.0.0   # Bind to all interfaces
urbtc daemon start --auth          # Enable authentication
urbtc daemon --config daemon.yaml  # Use custom config

# Remote Management
urbtc --host localhost:8080 list   # Connect to remote daemon
urbtc --host server.com get ubuntu # Remote download
```

### Scripting & Automation Support
```bash
# JSON Output for Scripts
urbtc list --json                  # JSON format output
urbtc get ubuntu --json --async    # Non-blocking download
urbtc store search docker --json   # JSON search results

# Batch Operations
urbtc get ubuntu fedora arch --batch    # Multiple downloads
urbtc pause --all                      # Pause everything
urbtc resume --pattern "ubuntu-*"      # Pattern-based resume
urbtc remove --completed --ratio ">2.0" # Conditional removal

# Exit Codes & Status
urbtc get ubuntu ; echo $?         # Check success (0 = success)
urbtc list --count-only            # Just return count
urbtc status --machine-readable    # Script-friendly status
```

## 🚀 Performance Optimizations

### Command Response Time Targets
```typescript
// Performance Requirements
const PERFORMANCE_TARGETS = {
  commandParsing: 5,      // 5ms to parse commands
  contentResolution: 20,  // 20ms to resolve content
  storeSearch: 50,        // 50ms for store search
  downloadStart: 2000,    // 2s to start download
  listGeneration: 30,     // 30ms to generate list
  configAccess: 10        // 10ms for config operations
};

// Smart Caching Strategy
class PerformanceManager {
  private contentCache = new LRUCache<string, ContentItem>(1000);
  private storeCache = new LRUCache<string, StoreResult[]>(500);
  
  async resolveContent(alias: string): Promise<ContentItem> {
    // Check cache first
    const cached = this.contentCache.get(alias);
    if (cached) return cached;
    
    // Resolve and cache
    const content = await this.resolver.resolve(alias);
    this.contentCache.set(alias, content);
    return content;
  }
}
```

### Intelligent Preloading
```typescript
// Predictive Content Loading
class PredictiveLoader {
  // Preload popular content on startup
  async warmupCache(): Promise<void> {
    const popular = ['ubuntu', 'fedora', 'arch', 'docker', 'vlc'];
    await Promise.all(popular.map(alias => 
      this.contentResolver.resolve(alias)
    ));
  }
  
  // Smart store preloading based on user patterns
  async preloadUserContent(): Promise<void> {
    const recentCategories = this.analytics.getRecentCategories();
    await this.store.preloadCategories(recentCategories);
  }
}
```

This CLI architecture creates a lightning-fast, intelligent command interface that scales from simple one-word commands to complex automation workflows, while maintaining the core philosophy of simplicity and speed.