# Security Policy

## Supported Versions

Currently, StreamGo is in active development. Security updates will be provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Security Features

StreamGo implements multiple layers of security to protect users:

### Content Security Policy (CSP)
- Strict CSP headers prevent XSS attacks
- No inline scripts or styles allowed
- Limited external resource domains (TMDB, fonts)
- All content served from trusted sources only

### Addon Security
- **Default-disabled addons**: All newly installed addons are disabled by default until user review
- **Manifest validation**: Strict validation of addon manifests including ID format, version format, and required fields
- **URL protocol validation**: Only HTTP/HTTPS protocols allowed for streaming URLs
- **Size limits**: 
  - Manifests limited to 100KB
  - API responses limited to 10MB
  - Catalog results limited to 1000 items
- **Request timeouts**: 5-second timeout for all addon requests
- **Redirect limits**: Maximum 3 redirects allowed

### Input Sanitization
- All user input is escaped before display
- HTML sanitization utilities prevent XSS attacks
- URL validation ensures only safe protocols
- Maximum input length enforcement

### Database Security
- Prepared statements prevent SQL injection
- Schema versioning with automatic migrations
- Secure storage in user's local data directory
- No sensitive data stored in plain text

### Network Security
- HTTPS enforced where possible
- Certificate validation for all external connections
- No data collection or analytics without consent
- User agent includes app name and version for transparency

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability in StreamGo, please follow these steps:

### 1. Do Not Publicly Disclose
Please do **not** open a public GitHub issue for security vulnerabilities. This could put users at risk.

### 2. Contact Us Privately
Send a detailed report to: **[Your security email here]**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)
- Your contact information

### 3. Response Timeline
- **24 hours**: Initial acknowledgment of your report
- **72 hours**: Preliminary assessment and severity classification
- **7 days**: Detailed response with mitigation plan
- **30 days**: Patch development and testing (for high-severity issues)

### 4. Coordinated Disclosure
We follow responsible disclosure principles:
- We will work with you to understand and validate the issue
- We will develop and test a fix
- We will coordinate the release timing with you
- You will be credited in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Installing Addons
1. Only install addons from trusted sources
2. Review addon manifests before enabling
3. Disable addons you don't actively use
4. Keep addons updated to the latest version
5. Report suspicious addon behavior

### General Usage
1. Keep StreamGo updated to the latest version
2. Use strong authentication if you implement user accounts
3. Review addon permissions regularly
4. Be cautious of streaming sources from unknown providers
5. Report any unusual behavior or security concerns

## Security Audits

### Completed Audits
- **P4 Security Hardening** (2025-10): CSP tightening, addon security, input sanitization
- **P6 Database Security** (2025-10): Migration system, schema versioning, index optimization

### Planned Audits
- External security review (Q1 2026)
- Penetration testing (Q2 2026)
- Dependency vulnerability scanning (automated, ongoing)

## Known Security Considerations

### Addon System
The addon system allows third-party code execution. While we implement strict validation:
- Addons can make arbitrary network requests (within protocol restrictions)
- Addons control the streaming sources presented to users
- Users should treat addons like browser extensions and only install trusted ones

### Local Data Storage
StreamGo stores data locally in:
- **Linux**: `~/.local/share/StreamGo/`
- **macOS**: `~/Library/Application Support/StreamGo/`
- **Windows**: `%LOCALAPPDATA%\StreamGo\`

This directory contains:
- SQLite database with library, preferences, and watch history
- Cache files for metadata and addon responses
- No sensitive authentication tokens (currently)

### Network Requests
StreamGo makes network requests to:
- **TMDB API**: Movie and TV show metadata
- **Addon servers**: Content catalogs and streaming URLs
- **Streaming sources**: Video content delivery

All requests are logged (debug mode) and can be monitored.

## Dependency Security

We regularly audit our dependencies for known vulnerabilities:

### Rust Dependencies
- Automated scanning via `cargo audit`
- Critical updates applied within 48 hours
- Regular dependency updates

### JavaScript Dependencies
- Automated scanning via `npm audit`
- Dependabot alerts enabled
- Regular security updates

## Secure Development Practices

### Code Review
- All changes reviewed before merging
- Security-focused code reviews for:
  - Network communication
  - User input handling
  - Database operations
  - Addon system changes

### Testing
- Unit tests for security-critical functions
- Integration tests for auth and permissions
- E2E tests for user workflows
- Fuzzing for input validation (planned)

### Build Security
- Reproducible builds
- Signed releases (coming soon)
- Checksum verification
- Supply chain security measures

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

*(No disclosures yet)*

## Contact

For security-related questions or concerns:
- **Security Email**: [Your security email]
- **General Issues**: [GitHub Issues](https://github.com/quigsdev/StreamGo/issues)
- **Discussion**: [GitHub Discussions](https://github.com/quigsdev/StreamGo/discussions)

## License

This security policy is licensed under CC BY 4.0.
