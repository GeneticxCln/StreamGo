# Code Signing Guide for StreamGo

**Last Updated**: 2025-10-16  
**Status**: Phase 3 - Distribution Ready

---

## Overview

StreamGo uses code signing to ensure the authenticity and integrity of distributed applications. This guide covers the setup and maintenance of code signing for all platforms.

---

## Current Status ✅

### Infrastructure
- ✅ **Tauri Updater**: Configured in `tauri.conf.json`
- ✅ **Public Key**: Already set in configuration
- ✅ **GitHub Secrets**: Placeholders ready in `.github/workflows/release.yml`
- ✅ **Multi-Platform Builds**: macOS (ARM64 + x86_64), Linux, Windows

### Configured Platforms
| Platform | Status | Signing Method |
|----------|--------|----------------|
| **Linux** | ✅ Ready | Tauri signing key (already configured) |
| **macOS** | ⏳ Needs certificates | Apple Developer Program |
| **Windows** | ⏳ Needs certificates | Code signing certificate |

---

## 1. Tauri Signing Key (All Platforms)

### Current Setup
The Tauri signing key is already generated and configured:

**Public Key** (in `tauri.conf.json`):
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDQ4ODIwREQ2RDUwMEIzN0MKUldSOHN3RFYxZzJDU0syN01nU0l2aFZyV3ppZnhwbEx2cFgrVjZzcnVrUkIwcTFYeGRxdmNteWQK
```

**GitHub Secrets Required**:
- `TAURI_SIGNING_PRIVATE_KEY`: The private key for signing
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password for the private key

### Generate New Key (if needed)

```bash
# Install Tauri CLI if not already installed
cargo install tauri-cli

# Generate new signing key pair
tauri signer generate -w ~/.tauri/streamgo.key

# This creates:
# - Private key: ~/.tauri/streamgo.key (KEEP SECURE!)
# - Public key: printed to console

# Add to GitHub Secrets:
# TAURI_SIGNING_PRIVATE_KEY: Content of ~/.tauri/streamgo.key
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD: Your chosen password
```

---

## 2. macOS Code Signing

### Prerequisites
1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com
   - Enroll in Apple Developer Program

2. **Certificates Needed**:
   - Developer ID Application Certificate
   - Developer ID Installer Certificate (optional)

### Step-by-Step Setup

#### A. Create Certificates in Apple Developer Portal

1. Go to: https://developer.apple.com/account/resources/certificates
2. Click **"+"** to create a new certificate
3. Select **"Developer ID Application"**
4. Follow the prompts to create a Certificate Signing Request (CSR)
5. Download the certificate (.cer file)

#### B. Export Certificate for CI/CD

```bash
# Open Keychain Access on macOS
# Find your "Developer ID Application" certificate
# Right-click → Export → Save as .p12 file

# Convert to base64 for GitHub Secrets
cat certificate.p12 | base64 > certificate.b64

# Copy the content of certificate.b64 to GitHub Secrets
```

#### C. Configure GitHub Secrets

Add these secrets to your repository:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate | Exported from Keychain |
| `APPLE_CERTIFICATE_PASSWORD` | Password for .p12 file | Set when exporting |
| `APPLE_SIGNING_IDENTITY` | Certificate name | e.g., "Developer ID Application: Your Name (TEAM_ID)" |
| `APPLE_ID` | Your Apple ID email | Your Apple account email |
| `APPLE_PASSWORD` | App-specific password | Generated at appleid.apple.com |
| `APPLE_TEAM_ID` | Your Team ID | Found in Apple Developer portal |

#### D. Generate App-Specific Password

1. Go to: https://appleid.apple.com/account/manage
2. Click **"App-Specific Passwords"**
3. Click **"+"** to generate a new password
4. Name it "StreamGo CI/CD"
5. Copy the password to `APPLE_PASSWORD` secret

### Notarization

macOS notarization is automatically handled by `tauri-action` when all Apple secrets are configured.

---

## 3. Windows Code Signing

### Prerequisites
1. **Code Signing Certificate** ($200-$500/year)
   - Providers: DigiCert, Sectigo, GlobalSign
   - Choose: "EV Code Signing" or "Standard Code Signing"

2. **Certificate Format**: `.pfx` or `.p12`

### Step-by-Step Setup

#### A. Purchase Certificate

Recommended providers:
- **DigiCert**: https://www.digicert.com/code-signing
- **Sectigo**: https://sectigo.com/ssl-certificates-tls/code-signing
- **SSL.com**: https://www.ssl.com/code-signing/

#### B. Export Certificate for CI/CD

```bash
# If you have a .pfx file:
# Convert to base64 for GitHub Secrets
certutil -encode certificate.pfx certificate.b64

# Or on Linux/macOS:
cat certificate.pfx | base64 > certificate.b64

# Copy the content to GitHub Secrets
```

#### C. Configure GitHub Secrets

| Secret Name | Description |
|-------------|-------------|
| `WINDOWS_CERTIFICATE` | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password |

#### D. Update Release Workflow

The Windows signing is not yet fully configured in the release workflow. Add this to `.github/workflows/release.yml`:

```yaml
- name: Sign Windows Binary
  if: matrix.platform == 'windows-latest'
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    # Decode certificate
    echo "$WINDOWS_CERTIFICATE" | base64 -d > certificate.pfx
    
    # Sign the executable
    signtool sign /f certificate.pfx /p "$WINDOWS_CERTIFICATE_PASSWORD" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "src-tauri/target/release/bundle/nsis/*.exe"
    
    # Clean up
    rm certificate.pfx
```

---

## 4. Linux Code Signing

### GPG Signing (Optional)

Linux distributions typically don't require code signing, but GPG signing adds trust:

```bash
# Generate GPG key
gpg --full-generate-key

# Export public key
gpg --armor --export your-email@example.com > public.asc

# Export private key (keep secure!)
gpg --armor --export-secret-keys your-email@example.com > private.asc

# Add to GitHub Secrets:
# GPG_PRIVATE_KEY: Content of private.asc
# GPG_PASSPHRASE: Your GPG key passphrase
```

---

## 5. Verification

### Verify Signed Application

#### macOS
```bash
# Check code signature
codesign -dv --verbose=4 /path/to/StreamGo.app

# Verify notarization
spctl -a -vvv -t install /path/to/StreamGo.app
```

#### Windows
```bash
# Check signature
signtool verify /pa /v StreamGo.exe
```

#### Linux (if GPG signed)
```bash
# Verify GPG signature
gpg --verify StreamGo.AppImage.sig StreamGo.AppImage
```

---

## 6. Auto-Updater Setup

The auto-updater is already configured! It works as follows:

### How It Works

1. **Release Creation**: When you push a tag (e.g., `v0.2.0`), GitHub Actions:
   - Builds for all platforms
   - Signs the binaries
   - Creates a draft release
   - Generates `latest.json` with update information

2. **Update Check**: StreamGo checks for updates at:
   ```
   https://github.com/GeneticxCln/StreamGo/releases/latest/download/latest.json
   ```

3. **User Notification**: If an update is available:
   - Dialog appears (configured with `"dialog": true`)
   - User can choose to update
   - Download and install happens automatically

### latest.json Format

```json
{
  "version": "0.2.0",
  "notes": "New features and bug fixes",
  "pub_date": "2025-10-16T00:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../streamgo_0.2.0_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../StreamGo_0.2.0_x64_en-US.msi.zip"
    },
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/.../StreamGo_0.2.0_aarch64.app.tar.gz"
    }
  }
}
```

---

## 7. Release Process

### Creating a New Release

```bash
# 1. Update version in Cargo.toml and package.json
# Edit: src-tauri/Cargo.toml
version = "0.2.0"

# Edit: package.json
"version": "0.2.0",

# 2. Update CHANGELOG.md with release notes

# 3. Commit changes
git add -A
git commit -m "chore: bump version to 0.2.0"

# 4. Create and push tag
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0

# 5. GitHub Actions will automatically:
#    - Build for all platforms
#    - Sign binaries
#    - Create draft release
#    - Upload artifacts

# 6. Review and publish the draft release on GitHub
```

### Release Checklist

Before creating a release:
- [ ] All tests passing
- [ ] Version bumped in `Cargo.toml` and `package.json`
- [ ] CHANGELOG.md updated
- [ ] Code signing certificates are valid
- [ ] GitHub secrets are configured
- [ ] Manual testing on all platforms (if possible)

---

## 8. Troubleshooting

### Issue: macOS "App is damaged" error
**Solution**: Notarization failed or certificate expired
- Check notarization status in Xcode organizer
- Verify certificate is valid
- Re-sign and re-notarize

### Issue: Windows SmartScreen warning
**Solution**: EV certificate required for immediate trust
- Standard certificates build reputation over time
- Consider upgrading to EV certificate
- Users can still run by clicking "More info" → "Run anyway"

### Issue: Linux "Permission denied"
**Solution**: AppImage not executable
```bash
chmod +x StreamGo.AppImage
```

### Issue: Update not detected
**Solution**: Check updater configuration
- Verify `latest.json` exists at the URL
- Check public key matches private key
- Ensure version number is higher

---

## 9. Security Best Practices

### Key Management
- ✅ **Never** commit private keys to git
- ✅ Store keys securely (password manager, vault)
- ✅ Use GitHub Secrets for CI/CD
- ✅ Rotate keys periodically (yearly)
- ✅ Use strong passwords for certificate files

### Certificate Maintenance
- 📅 Set calendar reminders for certificate expiration
- 📅 Renew certificates 1-2 months before expiration
- 📋 Keep backup of certificates in secure location
- 📋 Document renewal process

### Access Control
- 🔒 Limit who can create releases
- 🔒 Use branch protection for main branch
- 🔒 Require code review before merging
- 🔒 Enable 2FA on GitHub account

---

## 10. Costs Summary

| Item | Frequency | Cost |
|------|-----------|------|
| **Apple Developer Program** | Annual | $99/year |
| **Windows Code Signing** | Annual | $200-500/year |
| **Linux GPG** | One-time | Free |
| **Tauri Signing** | One-time | Free |
| **GitHub Actions** | Monthly | Free (2000 min) or $0.008/min |

**Total**: ~$300-600/year for all platforms

---

## 11. Next Steps

### Immediate
1. ⏳ Purchase Apple Developer Program membership
2. ⏳ Purchase Windows code signing certificate
3. ⏳ Configure GitHub Secrets
4. ✅ Test release workflow with dummy tag

### Future
- [ ] Set up automatic certificate renewal reminders
- [ ] Document emergency key rotation procedure
- [ ] Create release automation scripts
- [ ] Set up monitoring for update failures

---

## Resources

### Official Documentation
- **Tauri Signing**: https://tauri.app/v1/guides/distribution/sign-windows
- **Tauri Updater**: https://tauri.app/v1/guides/distribution/updater
- **Apple Notarization**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- **Windows Code Signing**: https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools

### Tools
- **signtool** (Windows): Part of Windows SDK
- **codesign** (macOS): Built into macOS
- **GPG**: https://gnupg.org

---

**Status**: Phase 3 infrastructure complete. Awaiting certificates for production deployment.
