# Backup & Recovery

## Quick Backup

Use the included backup script:

```bash
./scripts/backup.sh
```

This will:

- Detect current network (mainnet/testnet)
- Backup seed phrase, config, and database
- Save to `backups/phoenixd-{network}-{timestamp}/`

---

## Quick Recovery

Use the interactive recovery script:

```bash
./scripts/recovery.sh
```

Features:

- **Interactive menu** - Use ↑↓ arrow keys to select a backup
- **Shows backup details** - Network, date, and included files
- **Auto-configures network** - Updates `.env` based on backup
- **Safe restore** - Asks for confirmation before overwriting

---

## Getting Your Seed Phrase

Your seed phrase is the **only way** to recover your funds if something goes wrong. **Back it up immediately!**

```bash
# View your seed phrase
docker exec phoenixd cat /phoenix/.phoenix/seed.dat

# Or from local data directory
cat ./data/phoenixd/seed.dat
```

> 💡 **Note:** The same seed is used for both mainnet and testnet. Different keys are derived for each network using different derivation paths.

---

## Important Files

| File           | Description                         | Location in Container            |
| -------------- | ----------------------------------- | -------------------------------- |
| `seed.dat`     | **12-word seed phrase** (CRITICAL!) | `/phoenix/.phoenix/seed.dat`     |
| `phoenix.conf` | Configuration & API password        | `/phoenix/.phoenix/phoenix.conf` |
| `phoenix.*.db` | Channel & payment database          | `/phoenix/.phoenix/phoenix.*.db` |

---

## Emergency Seed Recovery

> 💡 **For daily use, install the PWA** - see [PWA Install Guide](pwa-install.md). This section is **only for emergencies** (server failure, data loss).

Your phoenixd seed is a standard **BIP39 12-word mnemonic**. If your server becomes permanently unavailable, you can recover your funds using:

- **Phoenix Mobile App** - Same wallet engine, for emergency recovery
- **Other Lightning wallets** - Check compatibility first
- **Bitcoin wallets** - For on-chain recovery only

> ⚠️ **Warning:** Running the same seed on multiple devices causes channel conflicts and potential fund loss. Use this **ONLY** if your phoenixd server is permanently unavailable.

---

## Best Practices

1. **Backup immediately** after first setup
2. **Store seed phrase offline** - Write it on paper, never digitally
3. **Test recovery** on testnet before trusting mainnet funds
4. **Regular backups** - Run `./scripts/backup.sh` periodically
5. **Multiple locations** - Keep backups in different physical locations
