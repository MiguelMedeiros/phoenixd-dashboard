# /create-release - Create a GitHub release from the latest tag

Create a GitHub release from the latest signed tag using the `gh` CLI.

## Reference

Releases page: https://github.com/MiguelMedeiros/phoenixd-dashboard/releases

## Instructions

### 1. Get the Latest Tag

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
git tag --list | sort -V | tail -1
```

### 2. Verify the Tag is Signed

```bash
git tag -v <tag>
```

### 3. Check if Release Already Exists

```bash
gh release view <tag> 2>/dev/null
```

If release exists, show error and stop.

### 4. Show Summary

Display to user:

```
🚀 Create Release

📌 Tag: v0.0.4-alpha
🔐 Signature: Verified ✅
📍 Commit: <hash> <message>

This will create a GitHub release with:
- Pre-release: Yes (alpha)
- Generate release notes: Yes
```

### 5. Create the Release (after user confirmation)

```bash
gh release create <tag> \
  --title "Phoenixd Dashboard <tag>" \
  --generate-notes \
  --prerelease \
  --verify-tag
```

## Variants

| Command | Action |
|---------|--------|
| `/create-release` | Create release from latest tag |
| `/create-release v0.0.4-alpha` | Create release from specific tag |
| `/create-release --draft` | Create as draft (not published) |

## Pre-release Detection

```
if tag contains "-alpha" or "-beta" or "-rc":
    use --prerelease flag
else:
    create as latest release
```

## Important Rules

- ONLY create releases from signed/verified tags
- Tags with `-alpha`, `-beta`, `-rc` suffix → `--prerelease` flag
- ALWAYS use `--verify-tag` to ensure tag signature is valid
- ALWAYS ask for confirmation before creating
- If release already exists, show error and stop

## Example Output

```
🚀 Create Release

📌 Tag: v0.0.4-alpha
🔐 Signature: Verified ✅
📍 Commit: abc1234 feat: add new feature

Creating GitHub release...
  Title: Phoenixd Dashboard v0.0.4-alpha
  Pre-release: Yes
  Generate notes: Yes

Proceed? (y/n): y

✅ Release created!
🔗 https://github.com/MiguelMedeiros/phoenixd-dashboard/releases/tag/v0.0.4-alpha

Note: GitHub Actions will build and attach desktop app binaries automatically.
```

## After Release

Remind user that:
1. GitHub Actions workflow `release-desktop.yml` will automatically build binaries
2. macOS (Apple Silicon), macOS (Intel), and Linux (.deb) will be attached
3. SHA256SUMS.txt will be generated for verification
