# Code Signing and Release Configuration

This document describes the code signing setup and required GitHub secrets for cross-platform builds and auto-updates.

## Overview

StreamGo uses Tauri's built-in signing and update mechanisms to provide secure, automated updates across Windows, macOS, and Linux platforms.

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings under `Settings > Secrets and variables > Actions`.

### Universal Secrets (Required for all platforms)

#### `TAURI_SIGNING_PRIVATE_KEY`
The private key generated for signing update bundles. This is used by all platforms for the auto-update mechanism.

**How to set:**
```bash
# The private key is stored at ~/.tauri/streamgo.key
cat ~/.tauri/streamgo.key
```
Copy the entire output (including the header and footer) and paste it as the secret value.

#### `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
The password you used when generating the signing key. If you didn't set a password (pressed Enter), leave this secret empty or don't create it.

**How to set:**
Enter the password you used during key generation.

---

### macOS Signing (Required for macOS builds)

For macOS distribution, you need an Apple Developer account and several certificates/credentials:

#### `APPLE_CERTIFICATE`
The base64-encoded .p12 certificate for code signing.

**How to obtain:**
1. Log into [Apple Developer Portal](https://developer.apple.com/)
2. Create a "Developer ID Application" certificate
3. Download the certificate and import it into Keychain Access
4. Export as .p12 with a password
5. Convert to base64:
```bash
base64 -i certificate.p12 | pbcopy
```

#### `APPLE_CERTIFICATE_PASSWORD`
The password you set when exporting the .p12 certificate.

#### `APPLE_SIGNING_IDENTITY`
Your Developer ID Application identity name. Usually looks like:
```
Developer ID Application: Your Name (TEAM_ID)
```

**How to find:**
```bash
security find-identity -v -p codesigning
```

#### `APPLE_ID`
Your Apple ID email address used for notarization.

#### `APPLE_PASSWORD`
An app-specific password for your Apple ID.

**How to generate:**
1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in
3. Generate an app-specific password in the Security section

#### `APPLE_TEAM_ID`
Your 10-character Apple Developer Team ID.

**How to find:**
1. Log into [Apple Developer Portal](https://developer.apple.com/)
2. Go to Membership section
3. Find your Team ID (e.g., `ABC1234567`)

---

### Windows Signing (Optional but recommended)

Windows code signing requires a code signing certificate from a Certificate Authority.

#### `WINDOWS_CERTIFICATE`
The base64-encoded .pfx certificate for Windows code signing.

**How to obtain:**
1. Purchase a code signing certificate from a CA (DigiCert, Sectigo, etc.)
2. Download the certificate as .pfx
3. Convert to base64:
```bash
base64 -i certificate.pfx > certificate.txt
```

#### `WINDOWS_CERTIFICATE_PASSWORD`
The password for the .pfx certificate.

---

### Linux Signing

Linux builds (AppImage, .deb) don't require additional signing beyond the Tauri update signature. The universal `TAURI_SIGNING_PRIVATE_KEY` is sufficient.

---

## Testing Locally

Before pushing a release, you can test the build process locally:

```bash
# Build for your current platform
npm run tauri build

# Test with specific target (macOS example)
npm run tauri build -- --target aarch64-apple-darwin
```

---

## Release Process

1. **Update version** in `package.json`, `Cargo.toml`, and `tauri.conf.json`
2. **Update CHANGELOG.md** with release notes
3. **Commit changes**: `git commit -am "chore: bump version to v1.0.0"`
4. **Create and push tag**: 
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
5. **Monitor GitHub Actions** for the release workflow
6. **Review the draft release** on GitHub
7. **Publish the release** when ready

---

## Security Notes

- **Never commit** signing keys or certificates to the repository
- Store the private key (`~/.tauri/streamgo.key`) securely and back it up
- Rotate the `TAURI_SIGNING_PRIVATE_KEY` if compromised (requires updating all clients)
- Use strong passwords for all certificate files
- Limit access to GitHub secrets to trusted team members only

---

## Troubleshooting

### macOS: "binary is not signed"
- Verify `APPLE_CERTIFICATE` and `APPLE_SIGNING_IDENTITY` are correct
- Ensure your certificate is valid and not expired

### macOS: Notarization fails
- Verify `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Check that your Apple ID has accepted the latest agreements in the Developer Portal

### Windows: "certificate not trusted"
- Ensure you're using a certificate from a trusted CA
- Verify the certificate is a code signing certificate (not SSL/TLS)

### Updates not working
- Verify the public key in `tauri.conf.json` matches `~/.tauri/streamgo.key.pub`
- Ensure `TAURI_SIGNING_PRIVATE_KEY` is set correctly in GitHub secrets
- Check that the release contains the `latest.json` file

---

## Resources

- [Tauri Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos)
- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
