# 📱 Installing as a Progressive Web App (PWA)

Phoenixd Dashboard is a **Progressive Web App** - install it on your phone or desktop like a native app, **without any app store**.

<p align="center">
  <img src="screenshots/pwa-mobile-home.png" alt="PWA Mobile" width="280">
</p>

---

## Why PWA?

| App Stores | PWA (This Dashboard) |
|------------|---------------------|
| ❌ Centralized gatekeepers | ✅ No middlemen |
| ❌ Can be removed/banned | ✅ Can't be censored |
| ❌ Requires account | ✅ Just open a URL |
| ❌ Privacy concerns | ✅ 100% self-hosted |
| ❌ Automatic tracking | ✅ No telemetry |
| ❌ Updates controlled by others | ✅ You control updates |

---

## Features

- 🏠 **Home Screen Icon** - Launch like a native app
- 📱 **Full Screen Mode** - No browser UI, feels native
- ⚡ **Fast Loading** - Cached assets for instant startup
- 🔔 **Push Notifications** - Get notified of incoming payments
- 📴 **Offline Support** - Basic functionality without network
- 🔄 **Auto Updates** - Always the latest version

---

## Installation Guide

### iOS (iPhone/iPad)

> ⚠️ **Important**: You must use **Safari**. Chrome and Firefox on iOS don't support PWA installation.

1. Open your dashboard URL in **Safari**
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Choose a name (e.g., "Lightning Wallet")
5. Tap **"Add"**

<details>
<summary>📸 Visual Guide</summary>

```
┌─────────────────────────────┐
│  Safari Address Bar         │
│  ┌───────────────────────┐  │
│  │ yourserver.com:3000   │  │
│  └───────────────────────┘  │
│                             │
│         Dashboard           │
│                             │
│  ┌─────────────────────┐    │
│  │     [Share ↑]       │    │ ← Tap this
│  └─────────────────────┘    │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│  Share Menu                 │
│  ┌─────────────────────┐    │
│  │ Add to Home Screen  │    │ ← Select this
│  └─────────────────────┘    │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│  Name: Lightning Wallet     │
│  ┌─────────────────────┐    │
│  │       [Add]         │    │ ← Tap Add
│  └─────────────────────┘    │
└─────────────────────────────┘
```

</details>

### Android

> 💡 **Recommended**: Use **Chrome** for the best experience.

1. Open your dashboard URL in **Chrome**
2. Tap the **menu** (three dots in top right)
3. Tap **"Install app"** or **"Add to Home Screen"**
4. Confirm the installation

<details>
<summary>📸 Visual Guide</summary>

```
┌─────────────────────────────┐
│  Chrome                [⋮]  │ ← Tap menu
│  ┌───────────────────────┐  │
│  │ yourserver.com:3000   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│  Menu                       │
│  ┌─────────────────────┐    │
│  │ Install app         │    │ ← Select this
│  └─────────────────────┘    │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│  Install Phoenixd Dashboard │
│  ┌─────────────────────┐    │
│  │     [Install]       │    │ ← Confirm
│  └─────────────────────┘    │
└─────────────────────────────┘
```

</details>

### Desktop (Chrome/Edge)

1. Open your dashboard URL
2. Look for the **install icon** in the address bar (➕ or 📥)
3. Click **"Install"**

Or use the menu:
1. Click the **menu** (three dots)
2. Select **"Install Phoenixd Dashboard"** or **"Create shortcut"**

---

## After Installation

Once installed, the app will:

- ✅ Appear on your home screen / app drawer
- ✅ Open in full-screen mode (no browser UI)
- ✅ Work independently from the browser
- ✅ Receive push notifications (if enabled)

<p align="center">
  <img src="screenshots/pwa-mobile-receive-qr.png" alt="PWA Receive" width="280">
</p>

<p align="center">
  <em>Receive payments with QR codes - just like a native wallet app</em>
</p>

---

## Enabling Push Notifications

To receive notifications when you get paid:

1. Open the PWA
2. Go to **Settings**
3. Find **Push Notifications**
4. Click **"Enable"**
5. Allow notifications when prompted

Now you'll get notified even when the app is in the background!

---

## Updating the PWA

The PWA automatically updates when you visit it. To force an update:

### iOS
1. Close the app completely (swipe up from app switcher)
2. Reopen the app

### Android
1. Open the app
2. Pull down to refresh
3. Or: Settings → Apps → Phoenixd Dashboard → Storage → Clear Cache

### Desktop
1. Close all instances
2. Reopen the app

---

## Troubleshooting

### "Add to Home Screen" not showing

**iOS:**
- Make sure you're using **Safari** (not Chrome or Firefox)
- The site must be served over HTTPS (or localhost)

**Android:**
- Make sure you're using **Chrome**
- Try visiting the site a few times first

### App doesn't update

1. Clear the app's cache
2. Close completely and reopen
3. Check your network connection

### Notifications not working

1. Check notification permissions in device settings
2. Make sure notifications are enabled in the app's Settings page
3. Some browsers/devices have "Do Not Disturb" modes

---

## Uninstalling

### iOS
Long-press the app icon → "Remove App" → "Delete App"

### Android
Long-press the app icon → "Uninstall" (or drag to trash)

### Desktop
Right-click the app → "Uninstall"

---

## Technical Details

The PWA uses:

- **Service Worker** for offline caching and push notifications
- **Web App Manifest** for install metadata
- **HTTPS** for secure connections (required for PWA features)

---

## Why Not App Stores?

App stores are centralized gatekeepers that:

1. **Can remove your app** - Bitcoin/crypto apps have been banned before
2. **Require accounts** - Privacy invasion
3. **Take cuts** - 15-30% of all transactions
4. **Control updates** - You wait for their approval
5. **Track everything** - Analytics, usage patterns, etc.

With a PWA:

- **You control everything** - Your server, your rules
- **Can't be censored** - No one can remove your app
- **No middlemen** - Direct connection to your node
- **Privacy first** - No tracking, no accounts
- **Instant updates** - Changes deploy immediately

**This is the sovereign way.** ⚡
