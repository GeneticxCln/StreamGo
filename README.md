# StreamGo - Modern Media Center

StreamGo is a cross-platform desktop application built with Rust and Tauri that replicates the core functionality of Stremio. It allows users to discover, watch, and organize movies, TV shows, and other content through an extensible addon system.

## Features

### Core Functionality
- **Content Discovery**: Search and browse movies, TV shows, documentaries, and more
- **Library Management**: Personal watchlist, favorites, and viewing history
- **Video Playback**: Integrated video player with subtitle support and quality selection
- **Addon System**: Extensible plugin architecture for content sources
- **Modern UI**: Responsive interface with dark/light theme support
- **Cross-Platform**: Runs on Windows, macOS, and Linux

### Technical Features
- **Rust Backend**: Fast, secure backend handling database operations and API integrations
- **SQLite Database**: Local storage for user data, library, and addon management
- **Async Operations**: Non-blocking I/O for smooth performance
- **Web Technologies**: Modern HTML/CSS/JavaScript frontend embedded via Tauri

## Technology Stack

- **Backend**: Rust with Tauri framework
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: SQLite with rusqlite
- **HTTP Client**: reqwest for API integrations
- **Build System**: Cargo for Rust, npm for frontend assets

## Project Structure

```
StreamGo/
├── src/                    # Frontend source files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles with theming
│   └── script.js          # JavaScript application logic
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Main application logic and Tauri commands
│   │   ├── models.rs      # Data structures and types
│   │   ├── database.rs    # SQLite database operations
│   │   └── api.rs         # External API integrations
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── dist/                  # Built frontend assets (generated)
├── package.json           # Frontend build scripts
└── README.md             # This file
```

## Getting Started

### Prerequisites
- Rust (1.77.2 or later)
- Node.js and npm
- System dependencies for Tauri (varies by platform)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd StreamGo
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install Rust dependencies:
   ```bash
   cd src-tauri
   cargo fetch
   cd ..
   ```

### Development

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Run in development mode:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

### Building for Production

1. Build the application:
   ```bash
   cd src-tauri
   cargo tauri build
   ```

The built application will be available in `src-tauri/target/release/bundle/`.

## Configuration

### Database
The application automatically creates a SQLite database in the user's local app data directory:
- **Windows**: `%LOCALAPPDATA%\StreamGo\streamgo.db`
- **macOS**: `~/Library/Application Support/StreamGo/streamgo.db`
- **Linux**: `~/.local/share/StreamGo/streamgo.db`

### Addons
The addon system supports multiple types of content providers:
- **Content Providers**: Supply streaming links and catalog data
- **Metadata Providers**: Supply movie/show information, posters, etc.
- **Subtitle Providers**: Supply subtitle files
- **Player Extensions**: Custom playback functionality

## Architecture

### Backend (Rust)
- **Database Layer**: SQLite operations for persistence
- **API Layer**: HTTP client for external service integration
- **Tauri Commands**: Exposed functions for frontend communication
- **Models**: Type-safe data structures with serde serialization

### Frontend (JavaScript)
- **App Class**: Main application logic and state management
- **Navigation**: Section-based routing system
- **Theme System**: Dynamic dark/light theme switching
- **Content Rendering**: Dynamic UI generation for media items
- **Search**: Real-time search with debouncing

### Communication
Frontend and backend communicate through Tauri's invoke system:
```javascript
// Frontend calls Rust function
const results = await window.__TAURI__.invoke('search_content', { query: 'movie name' });
```

```rust
// Rust function exposed to frontend
#[tauri::command]
async fn search_content(query: String) -> Result<Vec<MediaItem>, String> {
    // Implementation
}
```

## API Integration

The application is designed to integrate with various APIs:
- **TMDB**: Movie and TV show metadata
- **OpenSubtitles**: Subtitle files
- **Custom Addons**: User-installed content sources

## Security Considerations

- **Input Sanitization**: All user inputs are validated
- **Addon Sandboxing**: Addons run with limited permissions
- **CORS Handling**: Proper cross-origin request management
- **Data Privacy**: All data stored locally, no telemetry

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Stremio's architecture and user experience
- Built with the amazing Tauri framework
- Uses various open-source libraries and APIs