# /sync-translations - Sync translation files with en.json

Check and synchronize all translation files to match the structure of `en.json` (the default/source of truth).

## Usage

- `/sync-translations` - Check all translation files and report differences
- `/sync-translations fix` - Automatically fix all translation files to match en.json

## What This Command Does

1. **Compares** all language files against `en.json`
2. **Reports** missing keys, extra keys, and structural differences
3. **Optionally fixes** by adding missing keys (with English fallback) and removing extra keys

## Translation Files Location

```
frontend/src/messages/
├── en.json (source of truth)
├── pt.json
├── es.json
├── ar.json
├── de.json
├── fr.json
├── hi.json
├── ja.json
├── ko.json
├── ru.json
└── zh.json
```

## Instructions

### Step 1: Read the source file (en.json)

Read the complete `en.json` file to get all keys and structure.

### Step 2: Compare with other language files

For each language file, compare against en.json to find:
- **Missing keys**: Keys that exist in en.json but not in the language file
- **Extra keys**: Keys that exist in the language file but not in en.json
- **Structure differences**: Nested objects that don't match

### Step 3: Report or Fix

**Check mode (default):**
Generate a report table showing:

| Language | Missing Keys | Extra Keys | Status |
|----------|-------------|------------|--------|
| pt.json  | 0           | 0          | ✅     |
| es.json  | 2           | 1          | ⚠️     |
| ...      | ...         | ...        | ...    |

List specific missing/extra keys for each file with issues.

**Fix mode (`/sync-translations fix`):**
1. Add missing keys using English text as placeholder (with comment)
2. Remove extra keys that don't exist in en.json
3. Preserve existing translations
4. Maintain proper JSON formatting

## Helper Script

Create and run this Node.js script to perform the check:

```javascript
const fs = require('fs');
const path = require('path');

const messagesDir = './frontend/src/messages';
const sourceFile = 'en.json';

// Get all keys from an object recursively
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Get value by dot-notation key
function getValue(obj, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

// Set value by dot-notation key
function setValue(obj, key, value) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Delete value by dot-notation key
function deleteValue(obj, key) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) return;
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
}

// Main
const source = JSON.parse(fs.readFileSync(path.join(messagesDir, sourceFile), 'utf8'));
const sourceKeys = getAllKeys(source);

const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json') && f !== sourceFile);
const results = [];

for (const file of files) {
  const filePath = path.join(messagesDir, file);
  const target = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const targetKeys = getAllKeys(target);

  const missing = sourceKeys.filter(k => !targetKeys.includes(k));
  const extra = targetKeys.filter(k => !sourceKeys.includes(k));

  results.push({ file, missing, extra, target, filePath });
}

// Report
console.log('\n📊 Translation Sync Report\n');
console.log('| Language | Missing | Extra | Status |');
console.log('|----------|---------|-------|--------|');

for (const r of results) {
  const status = r.missing.length === 0 && r.extra.length === 0 ? '✅' : '⚠️';
  console.log(`| ${r.file.padEnd(8)} | ${String(r.missing.length).padEnd(7)} | ${String(r.extra.length).padEnd(5)} | ${status}      |`);
}

// Details
for (const r of results) {
  if (r.missing.length > 0 || r.extra.length > 0) {
    console.log(`\n📁 ${r.file}:`);
    if (r.missing.length > 0) {
      console.log('  Missing keys:');
      r.missing.forEach(k => console.log(`    - ${k}`));
    }
    if (r.extra.length > 0) {
      console.log('  Extra keys (to remove):');
      r.extra.forEach(k => console.log(`    - ${k}`));
    }
  }
}

// Fix mode
if (process.argv.includes('--fix')) {
  console.log('\n🔧 Fixing translation files...\n');
  for (const r of results) {
    let modified = false;
    
    // Add missing keys with English fallback
    for (const key of r.missing) {
      setValue(r.target, key, getValue(source, key));
      modified = true;
    }
    
    // Remove extra keys
    for (const key of r.extra) {
      deleteValue(r.target, key);
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(r.filePath, JSON.stringify(r.target, null, 2) + '\n');
      console.log(`✅ Fixed: ${r.file}`);
    }
  }
  console.log('\nDone!');
}
```

## Quick Commands

```bash
# Check translations (report only)
node -e "$(cat << 'SCRIPT'
// ... script above ...
SCRIPT
)"

# Fix translations
node -e "..." --fix
```

## Manual Check Process

If not using the script, manually:

1. Open en.json and each language file side by side
2. Use a JSON diff tool or compare keys
3. For missing keys: copy from en.json (translation can be updated later)
4. For extra keys: remove them from the language file

## Notes

- Always use en.json as the source of truth
- New features should add translations to en.json first
- Other language files can use English text as placeholder until translated
- Maintain alphabetical order of keys when possible
- Run this check before major releases
