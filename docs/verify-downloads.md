# Verify Downloads

This guide explains how to verify the integrity and authenticity of Phoenixd Dashboard downloads.

## Why Verify?

Verifying downloads ensures:
- **Integrity** - The file wasn't corrupted during download
- **Authenticity** - The file was released by the official maintainers

## Quick Verification (SHA256)

Every release includes a `SHA256SUMS.txt` file with checksums for all downloads.

### macOS / Linux

```bash
# 1. Download the app and SHA256SUMS.txt to the same folder

# 2. Verify the checksum
cd ~/Downloads
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Expected output:
```
Phoenixd-Dashboard_aarch64-apple-darwin.dmg: OK
```

### Windows (PowerShell)

```powershell
# 1. Download the app and SHA256SUMS.txt to the same folder

# 2. Get the expected hash from SHA256SUMS.txt
Get-Content SHA256SUMS.txt

# 3. Calculate the actual hash
Get-FileHash -Algorithm SHA256 Phoenixd-Dashboard_x64-setup.exe

# 4. Compare the hashes manually
```

## Full Verification (GPG Signature)

For maximum security, verify the GPG signature of the checksums file.

### 1. Import the Public Key

```bash
# Import from keyserver
gpg --keyserver keyserver.ubuntu.com --recv-keys <KEY_ID>

# Or download from GitHub
curl -sSL https://github.com/MiguelMedeiros.gpg | gpg --import
```

### 2. Verify the Signature

```bash
# Download SHA256SUMS.txt and SHA256SUMS.txt.asc
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
```

Expected output:
```
gpg: Signature made ...
gpg: Good signature from "Miguel Medeiros <...>"
```

### 3. Verify the Checksum

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

## Troubleshooting

### "shasum: WARNING: 1 listed file could not be read"

This means you only downloaded one file but the SHA256SUMS.txt lists all files. Use `--ignore-missing`:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

### "gpg: Can't check signature: No public key"

You need to import the maintainer's public key first. See step 1 above.

### Checksum Mismatch

If the checksum doesn't match:
1. Re-download the file
2. Try a different mirror or direct GitHub download
3. Report the issue if the problem persists

## Public Key

The releases are signed by:

- **Maintainer**: Miguel Medeiros
- **Email**: miguel@miguelmedeiros.com.br
- **Key ID**: `819EDEE4673F3EBB`
- **Fingerprint**: `46A3 AC83 95F9 5A6E 6D8F 1E34 819E DEE4 673F 3EBB`

### Import the Public Key

```bash
# From GitHub
curl -sSL https://github.com/MiguelMedeiros.gpg | gpg --import

# Or from keyserver
gpg --keyserver keyserver.ubuntu.com --recv-keys 819EDEE4673F3EBB
```

### Verify Key Fingerprint

After importing, verify the fingerprint matches:

```bash
gpg --fingerprint 819EDEE4673F3EBB
```

Expected output should include:
```
Key fingerprint = 46A3 AC83 95F9 5A6E 6D8F  1E34 819E DEE4 673F 3EBB
```
