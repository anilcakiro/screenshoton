# ScreenshotOn

Fast, lightweight screenshot tool for Windows. Select any region, copy it to the clipboard or save it as PNG, and browse your capture history — all from a global hotkey.

[🇹🇷 Türkçe](README.tr.md)

![Platform](https://img.shields.io/badge/platform-Windows-0078D4)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Wails](https://img.shields.io/badge/Wails-v3-1E90FF)
![React](https://img.shields.io/badge/React-19-61DAFB)

## Features

- **Region capture** — fullscreen overlay with free-form selection, zoom loupe, and live dimensions
- **Lossless PNG** — clipboard copy and file export without recompression artifacts
- **Configurable actions** — choose what happens after selection: manual, copy, or save
- **History gallery** — thumbnails, lightbox preview, date grouping, delete, and re-copy
- **Global hotkeys** — every shortcut is remappable and persisted
- **System-aware theming** — light, dark, or follow Windows
- **Turkish & English** — automatic locale detection with manual override
- **Start with Windows** — optional launch at sign-in
- **Self-updating** — checks GitHub Releases and installs updates in-app

## Tech stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Backend  | Go, [Wails v3](https://v3.wails.io) |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Package  | Wails NSIS installer (per-user, no UAC) |
| Updates  | GitHub Releases + Wails updater   |

## Getting started

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

Produces `bin/ScreenshotOn-amd64-installer.exe`, installed per-user under `%LocalAppData%` without admin rights.

## Project structure

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

## Releases & updates

Each release should provide these assets:

| Asset                              | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `screenshoton_windows_amd64.exe`   | Raw binary — used by the in-app updater   |
| `SHA256SUMS`                       | Checksum sidecar for update verification  |
| `ScreenshotOn-amd64-installer.exe` | NSIS installer — first-time installation  |

Generate the checksum file after building:

```sh
# Windows (PowerShell)
Get-FileHash .\screenshoton_windows_amd64.exe -Algorithm SHA256
# or with sha256sum:
sha256sum screenshoton_windows_amd64.exe > SHA256SUMS
```

Bump `AppVersion` in `services/update.go` before tagging so the updater compares correctly.

## License

This project is **source-available** under a custom license. You may use, study, inspect, download, and build the software for personal and commercial purposes, but you may **not** sell, redistribute, or publish the software, its binaries, installers, or modified versions.

See [LICENSE](LICENSE) for the full terms. For licensing inquiries: https://wareon.dev
