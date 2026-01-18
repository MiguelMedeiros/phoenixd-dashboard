# /create-tag - Create a GPG-signed git tag

Create a GPG-signed git tag following the project's versioning pattern.

## Tag Pattern

The project uses: `v0.0.X-alpha` format (e.g., `v0.0.1-alpha`, `v0.0.2-alpha`, `v0.0.3-alpha`)

Reference: https://github.com/MiguelMedeiros/phoenixd-dashboard/tags

## GPG Signing

All tags MUST be signed with GPG key: `819EDEE4673F3EBB` (Miguel Medeiros)

## Instructions

### 1. List Existing Tags

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
git tag --list | sort -V
```

### 2. Get Latest Tag and Calculate Next Version

- Parse the latest `v0.0.X-alpha` tag
- Increment the patch number (X → X+1)
- Example: `v0.0.3-alpha` → `v0.0.4-alpha`

### 3. Show Summary

Display to user:

```
🏷️ Create Tag

📋 Existing tags:
   v0.0.1-alpha.2
   v0.0.2-alpha
   v0.0.3-alpha

📌 Latest: v0.0.3-alpha
📝 Next version: v0.0.4-alpha
📍 Current HEAD: <commit hash> <message>
```

### 4. Ask for Tag Message

Ask user for tag message or use default: "Release vX.X.X-alpha"

### 5. Create Signed Tag

```bash
git tag -s -u 819EDEE4673F3EBB -m "<message>" <version>
```

### 6. Verify Signature

```bash
git tag -v <version>
```

### 7. Ask About Push

Ask if user wants to push:
- If yes: `git push origin <version>`
- If no: Show command to push later

## Variants

| Command | Action |
|---------|--------|
| `/create-tag` | Auto-increment to next version, ask for message |
| `/create-tag v0.0.5-alpha` | Create specific version |
| `/create-tag --push` | Auto-increment and push after creating |

## Important Rules

- NEVER create a tag without GPG signing
- ALWAYS verify the tag signature after creation
- ALWAYS ask for confirmation before pushing
- If tag already exists, show error and stop

## Example Output

```
🏷️ Create Tag

📋 Existing tags:
   v0.0.1-alpha.2
   v0.0.2-alpha
   v0.0.3-alpha

📌 Latest: v0.0.3-alpha
📝 Next version: v0.0.4-alpha
📍 Current HEAD: b992c19 feat: add external phoenixd support

Enter tag message (or press Enter for "Release v0.0.4-alpha"): 

🔐 Creating signed tag v0.0.4-alpha...
✅ Tag created and verified!

Push to origin? (y/n)
```
