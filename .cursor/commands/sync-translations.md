# /sync-translations - Sync translation files with en.json

Synchronize all translation files to match the structure of `en.json` (the default/source of truth).

## Usage

- `/sync-translations` - Sync all translation files (adds missing keys, removes extra keys)
- `/sync-translations check` - Only report differences without fixing

## What This Command Does

1. **Compares** all language files against `en.json`
2. **Reports** missing keys, extra keys, and structural differences
3. **Fixes** by adding missing keys (with English fallback) and removing extra keys

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

### Step 3: Fix and Report

1. Add missing keys using English text as placeholder
2. Remove extra keys that don't exist in en.json
3. Preserve existing translations
4. Maintain proper JSON formatting
5. Show summary table of changes

Generate a report table showing:

| Language | Missing Keys | Extra Keys | Status |
|----------|-------------|------------|--------|
| pt.json  | 0           | 0          | ✅     |
| es.json  | 2 (fixed)   | 1 (fixed)  | ✅     |
| ...      | ...         | ...        | ...    |

## Helper Script

Run this Node.js script to sync translations:

```bash
cd /Users/miguelmedeiros/code/phoenixd-dashboard
node -e "
const fs = require('fs');
const path = require('path');

const messagesDir = './frontend/src/messages';
const sourceFile = 'en.json';

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? \`\${prefix}.\${key}\` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValue(obj, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function setValue(obj, key, value) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function deleteValue(obj, key) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) return;
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
}

const source = JSON.parse(fs.readFileSync(path.join(messagesDir, sourceFile), 'utf8'));
const sourceKeys = getAllKeys(source);
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json') && f !== sourceFile);

console.log('\n📊 Translation Sync Report\n');
console.log('| Language | Missing | Extra | Status |');
console.log('|----------|---------|-------|--------|');

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(messagesDir, file);
  const target = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const targetKeys = getAllKeys(target);

  const missing = sourceKeys.filter(k => !targetKeys.includes(k));
  const extra = targetKeys.filter(k => !sourceKeys.includes(k));

  let modified = false;
  for (const key of missing) {
    setValue(target, key, getValue(source, key));
    modified = true;
  }
  for (const key of extra) {
    deleteValue(target, key);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(target, null, 2) + '\n');
    totalFixed++;
  }

  const status = missing.length === 0 && extra.length === 0 ? '✅' : '🔧';
  const missingStr = missing.length > 0 ? \`\${missing.length} fixed\` : '0';
  const extraStr = extra.length > 0 ? \`\${extra.length} fixed\` : '0';
  console.log(\`| \${file.padEnd(8)} | \${missingStr.padEnd(7)} | \${extraStr.padEnd(5)} | \${status}      |\`);
}

console.log(\`\n✅ Sync complete! \${totalFixed} files updated.\n\`);
"
```

## Notes

- Always use en.json as the source of truth
- New features should add translations to en.json first
- Other language files can use English text as placeholder until translated
- Maintain alphabetical order of keys when possible
- Run this before major releases
