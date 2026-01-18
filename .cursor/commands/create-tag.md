# /create-tag - Create a GPG-signed git tag

Automatically create, sign, and push the next git tag following the project's versioning pattern.

## Tag Pattern

The project uses: `v0.0.X-alpha` format (e.g., `v0.0.1-alpha`, `v0.0.2-alpha`, `v0.0.3-alpha`)

Reference: https://github.com/MiguelMedeiros/phoenixd-dashboard/tags

## GPG Signing

All tags MUST be signed with GPG key: `819EDEE4673F3EBB` (Miguel Medeiros)

## Instructions

Execute these steps automatically without asking for confirmation (except for push):

### 1. Get Current State

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
git tag --list | sort -V
git log -1 --format='%h %s'
```

### 2. Calculate Next Version

- Parse the latest `v0.0.X-alpha` tag
- Increment the patch number (X → X+1)
- Example: `v0.0.3-alpha` → `v0.0.4-alpha`

### 3. Create Signed Tag (automatic)

Use default message "Release vX.X.X-alpha" with changelog:

```bash
git tag -s -u 819EDEE4673F3EBB -m "Release v0.0.X-alpha" v0.0.X-alpha
```

### 4. Verify Signature

```bash
git tag -v v0.0.X-alpha
```

### 5. Push to GitHub (automatic)

```bash
git push origin v0.0.X-alpha
```

### 6. Show Summary

Display final result:

```
🏷️ Tag Created and Pushed!

📌 Tag: v0.0.4-alpha
🔐 Signature: Verified ✅
📍 Commit: <hash> <message>
🔗 https://github.com/MiguelMedeiros/phoenixd-dashboard/releases/tag/v0.0.4-alpha

Next: Run /create-release to create the GitHub release
```

## Variants

| Command | Action |
|---------|--------|
| `/create-tag` | Auto-increment, sign, and push |
| `/create-tag v0.0.5-alpha` | Create and push specific version |
| `/create-tag --no-push` | Create locally without pushing |

## Important Rules

- NEVER create a tag without GPG signing
- ALWAYS verify the tag signature after creation
- If tag already exists, show error and stop
- Push automatically to GitHub after creating

## Error Handling

- If GPG signing fails, show error and stop
- If tag already exists, show error and stop
- If push fails, show the manual push command
