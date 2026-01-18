# /commit - Stage, commit, and push changes

Automatically stage all changes, generate a commit message, and push to the remote repository.

## Instructions

Execute these steps in order:

### 1. Check Current State

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
git status
git diff --stat
git log -3 --oneline
```

### 2. Stage All Changes

```bash
git add -A
```

### 3. Generate Commit Message

Analyze the staged changes and generate a descriptive commit message following these conventions:

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, etc.)
- **refactor:** Code refactoring
- **test:** Adding or updating tests
- **chore:** Maintenance tasks

Format:
```
<type>: <short description>

<optional body with details>
```

### 4. Create Commit

```bash
git commit -m "$(cat <<'EOF'
<generated commit message>
EOF
)"
```

### 5. Push to Remote

```bash
git push origin HEAD
```

### 6. Show Summary

```
✅ Commit Created and Pushed!

📝 Message: <commit message>
📍 Commit: <hash>
📁 Files changed: <count>
🔗 <remote URL>
```

## Variants

| Command | Action |
|---------|--------|
| `/commit` | Stage all, generate message, commit and push |
| `/commit "message"` | Use provided message instead of generating |
| `/commit --no-push` | Commit locally without pushing |

## Important Rules

- ALWAYS show git status and diff before committing
- ALWAYS ask for confirmation before pushing
- NEVER commit sensitive files (.env, credentials, etc.)
- If there are no changes, show message and stop
- Generate meaningful commit messages based on actual changes

## Commit Message Guidelines

1. Use imperative mood ("add" not "added")
2. Keep first line under 72 characters
3. Reference issue numbers if applicable
4. Be specific about what changed

## Error Handling

- If no changes to commit, show message and stop
- If push fails, show the manual push command
- If there are merge conflicts, show instructions to resolve
