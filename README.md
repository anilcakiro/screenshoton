# ScreenshotOn

A fast, lightweight screenshot tool for Windows.

Capture any region of your screen with a single global hotkey; copy it to the clipboard or save it as a lossless PNG, and optionally annotate it with drawing tools.

[🇹🇷 Türkçe](README.tr.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

---

## Features

### Capture
- Free-form region selection on a fullscreen overlay
- Live dimension indicator and 8-way resizing
- Consistent behavior on high-DPI displays
- Lossless PNG output — no quality loss in preview or export

### Drawing and Annotation
- Five tools: pen, arrow, rectangle, ellipse, and auto-numbered pin
- Seven colors, undo, and clear-all
- Annotations are exported together with the selection to clipboard or file

### History
- Captures are automatically added to history
- Thumbnail grid, date-based grouping, and lightbox preview
- Delete individually or all at once, re-copy from history

### Sharing
- One-click copy to clipboard or save as PNG
- Post-selection behavior can be triggered automatically

### Platform
- Launch at Windows sign-in
- System tray integration
- Verified in-app updates

---

## Configurable Settings

| Setting | Description |
|---|---|
| Global hotkey | Default `PrintScreen` — opens the overlay; all shortcuts are remappable |
| Overlay shortcuts | Customize copy, save, and cancel keys |
| Post-selection behavior | Manual, auto-copy, or auto-save |
| Save folder | Changeable via a local directory picker (default: `Pictures\ScreenshotOn`) |
| Theme | Light, dark, or follow the Windows system theme |
| Language | Turkish or English — auto-detected from the PC locale |
| Start with Windows | Run automatically at sign-in |
| Preload overlay | Silently loads the overlay window into memory ~10s after startup; the first screenshot opens almost instantly.<br>• **Off** (default): the overlay is created on first use and consumes no RAM<br>• **On**: instant open in exchange for ~200 MB of additional RAM |

---

## System Requirements

- Windows 10/11 (x64)
- Microsoft Edge WebView2 Runtime (built into Windows 11)

## Installation

1. Download `ScreenshotOn-Setup.exe` from [GitHub Releases](https://github.com/anilcakiro/screenshoton/releases/latest).
2. Run the executable — it installs to `%LocalAppData%\Programs\Wareon\ScreenshotOn` without admin rights.
3. Press `PrintScreen` to open the overlay, select a region, and copy it.

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Backend  | Go, [Wails v3](https://v3.wails.io) |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Package  | Wails NSIS installer (per-user, no UAC) |
| Updates  | GitHub Releases + Wails updater   |

## Getting Started

### Prerequisites

- [Go](https://go.dev/dl/) 1.26+
- [Node.js](https://nodejs.org/) 20+
- [Wails3 CLI](https://v3.wails.io/getting-started/installation) (`wails3`)
- [NSIS](https://nsis.sourceforge.io) — only needed for installer packaging

### Development

```sh
wails3 dev
```

### Build

```sh
wails3 build
```

Produces `bin/screenshoton.exe`. Frontend bindings under `frontend/bindings/` are generated automatically by Wails — do not edit or commit them.

### Installer

```sh
wails3 package INSTALL_SCOPE=user
```

Produces `bin/ScreenshotOn-Setup.exe`, installed per-user under `%LocalAppData%` without admin rights.

## Project Structure

```
├── main.go               # App entry point, window, updater wiring
├── services/             # Go backend services (capture, settings, history, hotkeys, updates)
├── frontend/             # React + TypeScript frontend
│   └── src/
│       ├── pages/        # Home, Overlay, Settings, Selection, KeyboardShortcuts
│       ├── layouts/      # App shell and sidebar
│       ├── stores/       # Zustand state
│       └── i18n/         # tr.json / en.json translations
├── build/                # Icons, Windows metadata, NSIS templates, Taskfiles
└── Taskfile.yml          # Wails build tasks
```

## Releases & Updates

Each release should provide these assets:

| Asset                                   | Purpose                                   |
| --------------------------------------- | ----------------------------------------- |
| `ScreenshotOn-Setup.exe`                | NSIS installer — first-time installation  |
| `ScreenshotOn-Update-windows-amd64.exe` | Raw binary — used by the in-app updater   |
| `SHA256SUMS`                            | Checksum sidecar for update verification  |

Produce all three assets in one command:

```sh
wails3 task windows:release SIGN_THUMBPRINT=<your-cert-thumbprint>
```

This runs the production build, packages the NSIS installer, copies the binary to `ScreenshotOn-Update-windows-amd64.exe`, signs both executables, and generates `SHA256SUMS` — all inside `bin/`. Omit `SIGN_THUMBPRINT` to skip Authenticode signing.

Alternatively, generate the checksum manually after building:

```sh
# Windows (PowerShell)
Get-FileHash .\ScreenshotOn-Update-windows-amd64.exe -Algorithm SHA256
# or with sha256sum:
sha256sum ScreenshotOn-Update-windows-amd64.exe > SHA256SUMS
```

Bump `AppVersion` in `services/update.go` before tagging so the updater compares correctly.
