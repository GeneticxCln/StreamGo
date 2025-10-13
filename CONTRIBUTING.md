# Contributing to StreamGo

Thank you for your interest in contributing to StreamGo! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Rust (1.77.2 or later)
- Node.js and npm
- System dependencies for Tauri development

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GeneticxCln/StreamGo.git
   cd StreamGo
   ```

2. **Set up environment:**
   ```bash
   # Copy environment template
   cp .env.example .env
   # Edit .env and add your TMDB API key
   ```

3. **Install dependencies:**
   ```bash
   # Frontend dependencies
   npm install
   
   # Rust dependencies (optional, cargo will fetch as needed)
   cd src-tauri
   cargo fetch
   ```

4. **Build and run:**
   ```bash
   # Option 1: Using npm scripts (recommended)
   npm run dev            # Start Vite dev server
   npm run tauri:dev      # In another terminal, start Tauri
   
   # Option 2: Manual
   npm run build
   cd src-tauri
   cargo tauri dev
   ```

## 🛠️ Development Guidelines

### Code Style

**Rust:**
- Follow standard Rust formatting with `cargo fmt`
- Use `cargo clippy` for linting
- Write meaningful variable and function names
- Add documentation for public APIs

**Frontend (TypeScript/CSS):**
- Use TypeScript for type safety
- Run `npm run type-check` before committing
- Use consistent indentation (2 spaces)
- Follow modern ES6+ practices
- Write self-documenting code with clear variable names
- Use CSS custom properties for theming

### Commit Messages

Use conventional commit format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions or modifications
- `chore:` - Build process or auxiliary tool changes

Example: `feat: add video quality selection in player`

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

## 🐛 Reporting Issues

Before creating an issue, please:
1. Check existing issues to avoid duplicates
2. Use the issue templates provided
3. Include relevant system information
4. Provide steps to reproduce the problem

## 🔧 Pull Request Process

1. **Fork the repository** and create your branch from `main`

2. **Make your changes** following the guidelines above

3. **Test your changes:**
   ```bash
   # Using Makefile (recommended)
   make check          # Run all Rust checks
   npm run ci          # Run all frontend checks
   
   # Or manually:
   
   # Rust tests
   cd src-tauri && cargo test
   
   # Rust formatting
   cargo fmt --check
   
   # Rust linting
   cargo clippy -- -D warnings
   
   # TypeScript type checking
   npm run type-check
   
   # Frontend linting
   npm run lint
   
   # E2E tests
   npm run test:e2e
   
   # Test the application
   npm run tauri:dev
   ```

4. **Update documentation** if needed

5. **Create a pull request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes
   - Test results

## 📁 Project Structure

```
StreamGo/
├── src/                    # Frontend source
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── api.rs          # External API integrations
│   │   ├── database.rs     # Database operations
│   │   ├── models.rs       # Data structures
│   │   └── lib.rs          # Main application logic
├── .github/                # GitHub workflows and templates
└── docs/                   # Additional documentation
```

## 🎯 Areas for Contribution

### High Priority
- Real API integrations (TMDB, etc.)
- Enhanced addon system
- Video player improvements
- Performance optimizations

### Medium Priority
- Additional UI themes
- Keyboard shortcuts
- Search improvements
- Subtitle support

### Documentation
- API documentation
- User guides
- Development tutorials
- Architecture documentation

## 🔌 Addon Development

StreamGo uses an extensible addon system. To develop addons:

1. Study the addon manifest structure in `src-tauri/src/models.rs`
2. Create addons that implement the required interfaces
3. Test with the addon installation system
4. Submit as separate repositories with proper documentation

## 🧪 Testing

### Running Tests
```bash
# Rust unit tests
cd src-tauri && cargo test

# E2E tests with Playwright
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui

# View E2E test report
npm run test:e2e:report

# Run all tests
make test-all
```

### Test Categories
- **Unit tests**: Individual Rust functions (in `src-tauri/src/`)
- **Integration tests**: Rust modules integration (in `src-tauri/tests/`)
- **E2E tests**: Full user workflows with Playwright (in `tests/e2e/`)
- **Type checking**: TypeScript type validation

### Writing Tests
- Add Rust tests in the same file as the code or in `tests/`
- E2E tests go in `tests/e2e/` directory
- Use descriptive test names
- Test edge cases and error conditions
- Ensure tests are deterministic and don't depend on external state

## 📝 Documentation

- Update README.md for user-facing changes
- Add inline code documentation
- Update API documentation for new endpoints
- Create user guides for new features

## 💬 Community

- Be respectful and inclusive
- Help newcomers get started
- Share knowledge and best practices
- Provide constructive feedback

## 📄 License

By contributing to StreamGo, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Project documentation

Thank you for helping make StreamGo better! 🎬