# Release Process

This document describes the complete release process for StreamGo, from versioning to distribution.

## Table of Contents

- [Overview](#overview)
- [Versioning](#versioning)
- [Pre-Release Checklist](#pre-release-checklist)
- [Creating a Release](#creating-a-release)
- [Post-Release Tasks](#post-release-tasks)
- [Hotfix Releases](#hotfix-releases)
- [Rollback Procedure](#rollback-procedure)

---

## Overview

StreamGo uses automated releases via GitHub Actions. When you push a version tag, the CI/CD pipeline automatically:

1. Builds binaries for Windows, macOS (Intel & Apple Silicon), and Linux
2. Signs all binaries with the Tauri signing key
3. Creates code signatures for platform-specific requirements (macOS notarization, Windows Authenticode)
4. Generates update manifests (`latest.json`) for auto-update functionality
5. Creates a draft GitHub Release with all artifacts
6. Uploads build artifacts for distribution

---

## Versioning

StreamGo follows [Semantic Versioning](https://semver.org/) (SemVer):

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes or significant architectural updates
- **MINOR**: New features, backwards-compatible
- **PATCH**: Bug fixes and small improvements

### Version Locations

Version numbers must be synchronized across three files:

1. **`package.json`**: `version` field
2. **`src-tauri/Cargo.toml`**: `version` field in `[package]` section
3. **`src-tauri/tauri.conf.json`**: `version` field at root level

### Version Update Script

To update all versions at once:

```bash
# Replace 0.1.0 with your target version
./scripts/bump-version.sh 1.0.0
```

Or manually update all three files:

```bash
# Update package.json
npm version 1.0.0 --no-git-tag-version

# Update Cargo.toml
sed -i 's/^version = ".*"/version = "1.0.0"/' src-tauri/Cargo.toml

# Update tauri.conf.json
sed -i 's/"version": ".*"/"version": "1.0.0"/' src-tauri/tauri.conf.json
```

---

## Pre-Release Checklist

Before creating a release, ensure the following:

### Code Quality
- [ ] All tests pass locally (`make test`)
- [ ] All CI checks pass on main branch
- [ ] No unresolved merge conflicts
- [ ] Code has been reviewed and approved

### Documentation
- [ ] CHANGELOG.md has been updated with release notes
- [ ] README.md reflects current feature set
- [ ] API documentation is up to date (if applicable)
- [ ] Migration guides added for breaking changes (if applicable)

### Version Updates
- [ ] Version updated in `package.json`
- [ ] Version updated in `src-tauri/Cargo.toml`
- [ ] Version updated in `src-tauri/tauri.conf.json`
- [ ] All three versions match exactly

### Testing
- [ ] Manual testing completed on primary platform
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Known issues documented
- [ ] Critical bugs fixed

### Security
- [ ] Dependencies updated and audited (`npm audit`, `cargo audit`)
- [ ] No known security vulnerabilities
- [ ] Signing keys are valid and accessible
- [ ] GitHub secrets are configured correctly

---

## Creating a Release

### Step 1: Prepare the Release Branch

```bash
# Ensure you're on the latest main branch
git checkout main
git pull origin main

# Create a release branch (optional but recommended)
git checkout -b release/v1.0.0
```

### Step 2: Update Version Numbers

Update version in all three locations:

```bash
# Use the script (if available)
./scripts/bump-version.sh 1.0.0

# Or manually update:
# - package.json
# - src-tauri/Cargo.toml
# - src-tauri/tauri.conf.json
```

### Step 3: Update CHANGELOG

Edit `CHANGELOG.md` to document the changes in this release:

```markdown
## [1.0.0] - 2024-01-15

### Added
- New feature X
- New feature Y

### Changed
- Improved performance of Z

### Fixed
- Bug fix for issue #123
- Security fix for CVE-XXXX

### Breaking Changes
- Renamed API method from X to Y
```

### Step 4: Commit and Push

```bash
# Commit the version bump
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md
git commit -m "chore: bump version to v1.0.0"

# Push to main (or merge release branch)
git push origin main
```

### Step 5: Create and Push the Tag

```bash
# Create an annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag to trigger the release workflow
git push origin v1.0.0
```

### Step 6: Monitor the Release Build

1. Go to GitHub Actions: `https://github.com/quigsdev/StreamGo/actions`
2. Watch the "Release" workflow
3. Verify all platform builds succeed
4. Check for any signing or notarization errors

### Step 7: Review and Publish the Draft Release

1. Go to Releases: `https://github.com/quigsdev/StreamGo/releases`
2. Find the draft release created by the workflow
3. Review the release notes (auto-generated from CHANGELOG)
4. Verify all artifacts are attached:
   - Windows: `.msi`, `.exe`
   - macOS: `.dmg`, `.app.tar.gz`
   - Linux: `.AppImage`, `.deb`
   - Update manifests: `latest.json`
5. Edit release notes if needed
6. **Publish the release**

---

## Post-Release Tasks

### Verify Auto-Updates

Test that the auto-update mechanism works:

1. Install a previous version of StreamGo
2. Launch the app
3. Check for updates (should detect the new version)
4. Verify the update downloads and installs correctly

### Announce the Release

- [ ] Post release announcement on project website
- [ ] Notify users via email/newsletter (if applicable)
- [ ] Update social media channels
- [ ] Post in community forums/Discord

### Monitor for Issues

- [ ] Watch GitHub Issues for bug reports
- [ ] Monitor crash reports (if telemetry is enabled)
- [ ] Track user feedback

### Update Documentation Sites

- [ ] Update docs.streamgo.com (if applicable)
- [ ] Update API documentation
- [ ] Update installation guides

---

## Hotfix Releases

For critical bugs that need immediate fixes:

### Step 1: Create Hotfix Branch

```bash
git checkout main
git pull origin main
git checkout -b hotfix/v1.0.1
```

### Step 2: Make the Fix

```bash
# Make your changes
git add .
git commit -m "fix: critical bug in X"
```

### Step 3: Bump Patch Version

```bash
# Update to patch version (e.g., 1.0.0 -> 1.0.1)
./scripts/bump-version.sh 1.0.1
```

### Step 4: Follow Normal Release Process

```bash
git push origin hotfix/v1.0.1

# Merge to main
git checkout main
git merge hotfix/v1.0.1
git push origin main

# Tag and release
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin v1.0.1
```

---

## Rollback Procedure

If a release has critical issues:

### Option 1: Quick Hotfix (Preferred)

Release a new patch version with the fix (see Hotfix Releases above).

### Option 2: Delete Release and Tag

```bash
# Delete the GitHub release manually through the UI

# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0
```

**Note:** Deleting releases can confuse users who've already updated. Prefer hotfix releases.

### Option 3: Yanking (Not Recommended)

Mark the release as "Pre-release" in GitHub to prevent auto-updates, but keep it visible for transparency.

---

## Release Workflow Diagram

```
┌─────────────────────┐
│  Update Versions    │
│  (package.json,     │
│   Cargo.toml, etc)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Update CHANGELOG   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Commit & Push      │
│  to main            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Create Git Tag     │
│  (e.g., v1.0.0)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Push Tag           │
│  (triggers CI)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  GitHub Actions     │
│  - Build all        │
│  - Sign binaries    │
│  - Create draft     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Review & Publish   │
│  Draft Release      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Post-Release       │
│  Verification       │
└─────────────────────┘
```

---

## Troubleshooting

### Build Fails on One Platform

- Check the GitHub Actions logs for that specific platform
- Test locally on that platform if possible
- Consider releasing without that platform temporarily (not recommended)

### Signing/Notarization Fails

- Verify GitHub secrets are correctly configured (see `CODE_SIGNING.md`)
- Check certificate expiration dates
- Ensure Apple Developer agreements are accepted

### Auto-Update Not Working

- Verify `latest.json` is present in the release
- Check that the public key in `tauri.conf.json` matches the private key used for signing
- Ensure the updater endpoints URL is correct

### Version Mismatch Errors

- Ensure all three version locations are synchronized
- Re-run the version bump script
- Check for typos in version strings

---

## Additional Resources

- [CODE_SIGNING.md](./CODE_SIGNING.md) - Platform-specific signing setup
- [Tauri Release Documentation](https://tauri.app/v1/guides/distribution/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
